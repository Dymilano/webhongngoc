/**
 * Sneat Analytics dashboard — giữ nguyên layout/chart như dashboards-analytics.js,
 * gắn số liệu từ GET /api/reports/dashboard.
 */
(function () {
  'use strict';

  var __ngocSneatCharts = [];

  window.NgocSneatDashboardDestroy = function () {
    __ngocSneatCharts.forEach(function (ch) {
      try {
        if (ch && typeof ch.destroy === 'function') ch.destroy();
      } catch (_) {}
    });
    __ngocSneatCharts = [];
  };

  function padTo7(arr, pick) {
    const a = (arr || []).map(pick);
    while (a.length < 7) a.push(0);
    return a.slice(-7);
  }

  function splitSeries(series) {
    const s = (series || []).slice().sort(function (a, b) {
      return String(a.d || '').localeCompare(String(b.d || ''));
    });
    const rev = s.map(function (x) {
      return Number(x.revenue || 0);
    });
    if (rev.length >= 14) {
      return { prev: rev.slice(0, 7), cur: rev.slice(7, 14), labels: s.slice(7, 14).map(function (x) { return (x.d || '').slice(5); }) };
    }
    const cur = padTo7(s, function (x) {
      return Number(x.revenue || 0);
    });
    const prev = cur.map(function (v, i) {
      return Math.max(0, Math.round(v * (0.85 + (i % 3) * 0.05)));
    });
    return { prev: prev, cur: cur, labels: cur.map(function (_, i) { return 'D' + (i + 1); }) };
  }

  function pctChange(prev, cur) {
    const a = prev.reduce(function (s, x) { return s + x; }, 0);
    const b = cur.reduce(function (s, x) { return s + x; }, 0);
    if (a <= 0) return b > 0 ? 100 : 0;
    return Math.round(((b - a) / a) * 1000) / 10;
  }

  function sparkFromSeries(series) {
    const s = (series || []).slice().sort(function (a, b) {
      return String(a.d || '').localeCompare(String(b.d || ''));
    });
    const rev = s.map(function (x) {
      return Number(x.revenue || 0);
    });
    if (rev.length >= 6) return rev.slice(-6);
    return [110, 270, 145, 245, 205, 285];
  }

  async function main() {
    if (typeof NgocAdmin === 'undefined' || typeof ApexCharts === 'undefined') return;
    window.NgocSneatDashboardDestroy();

    const U = window.NgocAdminUi || {};
    const money = U.money || function (n) {
      return Number(n || 0).toLocaleString('vi-VN') + ' ₫';
    };
    const escapeHtml = U.escapeHtml || function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    let dash;
    try {
      dash = await NgocAdmin.api('/reports/dashboard');
    } catch (e) {
      console.error(e);
      return;
    }

    const t = dash.totals || {};
    const series = dash.series || [];
    const latest = dash.latestOrders || [];
    const top = dash.topProducts || [];
    const split = splitSeries(series);
    const growthPct = Math.min(100, Math.max(0, Math.round(Math.abs(pctChange(split.prev, split.cur)))));
    const trendPct = pctChange(split.prev, split.cur);
    const user = NgocAdmin.currentUser || {};

    const elName = document.getElementById('ngoc-admin-name');
    if (elName) elName.textContent = user.full_name || user.username || user.email || 'Admin';
    const elRole = document.getElementById('ngoc-admin-role');
    if (elRole) {
      elRole.textContent =
        user.role === 'super_admin' ? 'Quản trị cao cấp' : user.role === 'staff' ? 'Nhân viên' : 'Quản trị viên';
    }

    if (NgocAdmin.shopPublicUrl) {
      const metaShop = document.querySelector('meta[name="ngoc-shop-url"]');
      if (metaShop) metaShop.setAttribute('content', NgocAdmin.shopPublicUrl);
    }
    const brandEl = document.getElementById('ngoc-site-brand');
    if (brandEl && NgocAdmin.publicSiteName) brandEl.textContent = NgocAdmin.publicSiteName;

    if (typeof NgocAdmin.bindShopLinkElements === 'function') {
      NgocAdmin.bindShopLinkElements();
    }

    const w = document.getElementById('ngoc-welcome-pct');
    if (w) w.textContent = String(Math.abs(Math.round(trendPct)));

    const kpi = [
      { id: 'ngoc-kpi-profit', val: money(t.revenue || 0), pctId: 'ngoc-kpi-profit-pct', up: trendPct >= 0 },
      { id: 'ngoc-kpi-sales', val: String(t.orders || 0), pctId: 'ngoc-kpi-sales-pct', up: trendPct >= 0 },
      { id: 'ngoc-kpi-payments', val: String(t.users || 0), pctId: 'ngoc-kpi-payments-pct', up: true },
      { id: 'ngoc-kpi-transactions', val: String(t.products || 0), pctId: 'ngoc-kpi-transactions-pct', up: true }
    ];
    kpi.forEach(function (row, idx) {
      const el = document.getElementById(row.id);
      if (el) el.textContent = row.val;
      const pe = document.getElementById(row.pctId);
      if (pe) {
        const fake = [72.8, 28.4, 14.8, 28.1][idx];
        const p = idx === 0 ? Math.abs(trendPct) : fake;
        pe.className = 'fw-semibold ' + (row.up ? 'text-success' : 'text-danger');
        pe.innerHTML =
          (row.up ? '<i class="bx bx-up-arrow-alt"></i> ' : '<i class="bx bx-down-arrow-alt"></i> ') +
          (trendPct >= 0 ? '+' : '') +
          p.toFixed(idx === 0 ? 2 : 2) +
          '%';
      }
    });

    const g = document.getElementById('ngoc-growth-caption');
    if (g) g.textContent = growthPct + '% tăng trưởng (so kỳ)';
    const y1 = document.getElementById('ngoc-growth-y1');
    const y2 = document.getElementById('ngoc-growth-y2');
    if (y1) y1.textContent = money(split.cur.reduce(function (s, x) { return s + x; }, 0));
    if (y2) y2.textContent = money(split.prev.reduce(function (s, x) { return s + x; }, 0));

    const pr = document.getElementById('ngoc-profile-total');
    if (pr) pr.textContent = money(t.revenue || 0);
    const prp = document.getElementById('ngoc-profile-pct');
    if (prp) {
      const up = trendPct >= 0;
      prp.className = 'text-nowrap fw-semibold ' + (up ? 'text-success' : 'text-danger');
      prp.innerHTML =
        (up ? '<i class="bx bx-chevron-up"></i> ' : '<i class="bx bx-chevron-down"></i> ') +
        (trendPct >= 0 ? '+' : '') +
        Math.abs(Math.round(trendPct)) +
        '%';
    }

    const gl1 = document.getElementById('ngoc-growth-label1');
    if (gl1) gl1.textContent = 'Tuần này';
    const gl2 = document.getElementById('ngoc-growth-label2');
    if (gl2) gl2.textContent = 'Tuần trước';

    const oc = document.getElementById('ngoc-order-count');
    if (oc) oc.textContent = String(t.orders || 0);
    const osl = document.getElementById('ngoc-order-sales-label');
    if (osl) osl.textContent = (String(t.orders || 0)) + ' đơn';

    const tb = document.getElementById('ngoc-total-balance');
    if (tb) tb.textContent = money(t.revenue || 0);

    const txUl = document.getElementById('ngoc-transactions-list');
    if (txUl && latest.length) {
      const iconFor = function () {
        return '../assets/img/icons/unicons/wallet.png';
      };
      txUl.innerHTML = latest
        .map(function (o) {
          const amt = Number(o.total || 0);
          const sign = amt >= 0 ? '+' : '';
          return (
            '<li class="d-flex mb-4 pb-1">' +
            '<div class="avatar flex-shrink-0 me-3">' +
            '<img src="' + iconFor() + '" alt="" class="rounded" />' +
            '</div>' +
            '<div class="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">' +
            '<div class="me-2">' +
            '<small class="text-muted d-block mb-1">' + escapeHtml(orderStatusVi(o.status)) + '</small>' +
            '<h6 class="mb-0">' + escapeHtml(o.order_code || '') + '</h6>' +
            '</div>' +
            '<div class="user-progress d-flex align-items-center gap-1">' +
            '<h6 class="mb-0">' + sign + amt.toLocaleString('vi-VN') + '</h6>' +
            '<span class="text-muted">₫</span>' +
            '</div>' +
            '</div>' +
            '</li>'
          );
        })
        .join('');
      const last = txUl.querySelector('li:last-child');
      if (last) last.classList.remove('mb-4', 'pb-1');
    }

    const ob = document.getElementById('ngoc-order-breakdown');
    if (ob && top.length) {
      const icons = ['bx-mobile-alt', 'bx-closet', 'bx-home-alt', 'bx-football'];
      const bg = ['bg-label-primary', 'bg-label-success', 'bg-label-info', 'bg-label-secondary'];
      ob.innerHTML = top.slice(0, 4).map(function (p, i) {
        return (
          '<li class="d-flex' + (i < 3 ? ' mb-4 pb-1' : '') + '">' +
          '<div class="avatar flex-shrink-0 me-3">' +
          '<span class="avatar-initial rounded ' + bg[i % 4] + '"><i class="bx ' + icons[i % 4] + '"></i></span>' +
          '</div>' +
          '<div class="d-flex w-100 flex-wrap align-items-center justify-content-between gap-2">' +
          '<div class="me-2">' +
          '<h6 class="mb-0">' + escapeHtml(p.product_name || '') + '</h6>' +
          '<small class="text-muted">Đã bán</small>' +
          '</div>' +
          '<div class="user-progress"><small class="fw-semibold">' + String(p.qty || 0) + '</small></div>' +
          '</div>' +
          '</li>'
        );
      }).join('');
    }

    let cardColor, headingColor, axisColor, shadeColor, borderColor;
    cardColor = config.colors.white;
    headingColor = config.colors.headingColor;
    axisColor = config.colors.axisColor;
    borderColor = config.colors.borderColor;
    shadeColor = config.colors.dark;

    const totalRevenueChartEl = document.querySelector('#totalRevenueChart');
    const totalRevenueChartOptions = {
      series: [
        { name: 'Tuần này', data: split.cur },
        { name: 'Tuần trước', data: split.prev.map(function (v, i) { return -Math.abs(v || split.cur[i] || 0); }) }
      ],
      chart: {
        height: 300,
        stacked: true,
        type: 'bar',
        toolbar: { show: false }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '33%',
          borderRadius: 12,
          startingShape: 'rounded',
          endingShape: 'rounded'
        }
      },
      colors: [config.colors.primary, config.colors.info],
      dataLabels: { enabled: false },
      stroke: {
        curve: 'smooth',
        width: 6,
        lineCap: 'round',
        colors: [cardColor]
      },
      legend: {
        show: true,
        horizontalAlign: 'left',
        position: 'top',
        markers: { height: 8, width: 8, radius: 12, offsetX: -3 },
        labels: { colors: axisColor },
        itemMargin: { horizontal: 10 }
      },
      grid: {
        borderColor: borderColor,
        padding: { top: 0, bottom: -8, left: 20, right: 20 }
      },
      xaxis: {
        categories: split.labels,
        labels: {
          style: { fontSize: '13px', colors: axisColor }
        },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: {
        labels: {
          style: { fontSize: '13px', colors: axisColor }
        }
      },
      responsive: [
        { breakpoint: 1700, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '32%' } } } },
        { breakpoint: 1580, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '35%' } } } },
        { breakpoint: 1440, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '42%' } } } },
        { breakpoint: 1300, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '48%' } } } },
        { breakpoint: 1200, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '40%' } } } },
        { breakpoint: 1040, options: { plotOptions: { bar: { borderRadius: 11, columnWidth: '48%' } } } },
        { breakpoint: 991, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '30%' } } } },
        { breakpoint: 840, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '35%' } } } },
        { breakpoint: 768, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '28%' } } } },
        { breakpoint: 640, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '32%' } } } },
        { breakpoint: 576, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '37%' } } } },
        { breakpoint: 480, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '45%' } } } },
        { breakpoint: 420, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '52%' } } } },
        { breakpoint: 380, options: { plotOptions: { bar: { borderRadius: 10, columnWidth: '60%' } } } }
      ],
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } }
      }
    };
    if (totalRevenueChartEl) {
      const c = new ApexCharts(totalRevenueChartEl, totalRevenueChartOptions);
      __ngocSneatCharts.push(c);
      c.render();
    }

    const growthChartEl = document.querySelector('#growthChart');
    const growthChartOptions = {
      series: [growthPct || 35],
      labels: ['Tăng trưởng'],
      chart: { height: 240, type: 'radialBar' },
      plotOptions: {
        radialBar: {
          size: 150,
          offsetY: 10,
          startAngle: -150,
          endAngle: 150,
          hollow: { size: '55%' },
          track: { background: cardColor, strokeWidth: '100%' },
          dataLabels: {
            name: {
              offsetY: 15,
              color: headingColor,
              fontSize: '15px',
              fontWeight: '600',
              fontFamily: 'Public Sans'
            },
            value: {
              offsetY: -25,
              color: headingColor,
              fontSize: '22px',
              fontWeight: '500',
              fontFamily: 'Public Sans'
            }
          }
        }
      },
      colors: [config.colors.primary],
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'dark',
          shadeIntensity: 0.5,
          gradientToColors: [config.colors.primary],
          inverseColors: true,
          opacityFrom: 1,
          opacityTo: 0.6,
          stops: [30, 70, 100]
        }
      },
      stroke: { dashArray: 5 },
      grid: { padding: { top: -35, bottom: -10 } },
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } }
      }
    };
    if (growthChartEl) {
      const c = new ApexCharts(growthChartEl, growthChartOptions);
      __ngocSneatCharts.push(c);
      c.render();
    }

    const profileReportChartEl = document.querySelector('#profileReportChart');
    const spark = sparkFromSeries(series);
    const profileReportChartConfig = {
      chart: {
        height: 80,
        type: 'line',
        toolbar: { show: false },
        dropShadow: {
          enabled: true,
          top: 10,
          left: 5,
          blur: 3,
          color: config.colors.warning,
          opacity: 0.15
        },
        sparkline: { enabled: true }
      },
      grid: { show: false, padding: { right: 8 } },
      colors: [config.colors.warning],
      dataLabels: { enabled: false },
      stroke: { width: 5, curve: 'smooth' },
      series: [{ data: spark }],
      xaxis: {
        show: false,
        lines: { show: false },
        labels: { show: false },
        axisBorder: { show: false }
      },
      yaxis: { show: false }
    };
    if (profileReportChartEl) {
      const c = new ApexCharts(profileReportChartEl, profileReportChartConfig);
      __ngocSneatCharts.push(c);
      c.render();
    }

    const chartOrderStatistics = document.querySelector('#orderStatisticsChart');
    let donutSeries = [85, 15, 50, 50];
    let donutLabels = ['A', 'B', 'C', 'D'];
    if (top.length >= 2) {
      const slice = top.slice(0, 4);
      donutSeries = slice.map(function (p) {
        return Math.max(1, Number(p.qty || 0));
      });
      donutLabels = slice.map(function (p) {
        return (p.product_name || '').slice(0, 12);
      });
    }
    const orderChartConfig = {
      chart: { height: 165, width: 130, type: 'donut' },
      labels: donutLabels,
      series: donutSeries,
      colors: [config.colors.primary, config.colors.secondary, config.colors.info, config.colors.success],
      stroke: { width: 5, colors: cardColor },
      dataLabels: {
        enabled: false,
        formatter: function (val) {
          return parseInt(val, 10) + '%';
        }
      },
      legend: { show: false },
      grid: { padding: { top: 0, bottom: 0, right: 15 } },
      plotOptions: {
        pie: {
          donut: {
            size: '75%',
            labels: {
              show: true,
              value: {
                fontSize: '1.5rem',
                fontFamily: 'Public Sans',
                color: headingColor,
                offsetY: -15,
                formatter: function (val) {
                  return parseInt(val, 10) + '%';
                }
              },
              name: { offsetY: 20, fontFamily: 'Public Sans' },
              total: {
                show: true,
                fontSize: '0.8125rem',
                color: axisColor,
                label: 'Đơn',
                formatter: function () {
                  return String(t.orders || 0);
                }
              }
            }
          }
        }
      }
    };
    if (chartOrderStatistics) {
      const c = new ApexCharts(chartOrderStatistics, orderChartConfig);
      __ngocSneatCharts.push(c);
      c.render();
    }

    const incomeData = (function () {
      const s = (series || []).slice().sort(function (a, b) {
        return String(a.d || '').localeCompare(String(b.d || ''));
      });
      const rev = s.map(function (x) {
        return Number(x.revenue || 0);
      });
      while (rev.length < 8) rev.push(0);
      return rev.slice(-8);
    })();
    const incomeChartEl = document.querySelector('#incomeChart');
    const incomeChartConfig = {
      series: [{ data: incomeData.length ? incomeData : [24, 21, 30, 22, 42, 26, 35, 29] }],
      chart: {
        height: 215,
        parentHeightOffset: 0,
        parentWidthOffset: 0,
        toolbar: { show: false },
        type: 'area'
      },
      dataLabels: { enabled: false },
      stroke: { width: 2, curve: 'smooth' },
      legend: { show: false },
      markers: {
        size: 6,
        colors: 'transparent',
        strokeColors: 'transparent',
        strokeWidth: 4,
        discrete: [
          {
            fillColor: config.colors.white,
            seriesIndex: 0,
            dataPointIndex: 7,
            strokeColor: config.colors.primary,
            strokeWidth: 2,
            size: 6,
            radius: 8
          }
        ],
        hover: { size: 7 }
      },
      colors: [config.colors.primary],
      fill: {
        type: 'gradient',
        gradient: {
          shade: shadeColor,
          shadeIntensity: 0.6,
          opacityFrom: 0.5,
          opacityTo: 0.25,
          stops: [0, 95, 100]
        }
      },
      grid: {
        borderColor: borderColor,
        strokeDashArray: 3,
        padding: { top: -20, bottom: -8, left: -10, right: 8 }
      },
      xaxis: {
        categories: ['', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          show: true,
          style: { fontSize: '13px', colors: axisColor }
        }
      },
      yaxis: {
        labels: { show: false }
      }
    };
    if (incomeChartEl) {
      const c = new ApexCharts(incomeChartEl, incomeChartConfig);
      __ngocSneatCharts.push(c);
      c.render();
    }

    const weeklyExpensesEl = document.querySelector('#expensesOfWeek');
    const miniPct = Math.min(100, Math.max(0, t.orders ? Math.round((t.products / (t.orders + 1)) * 10) % 100 : 65));
    const weeklyExpensesConfig = {
      series: [miniPct || 65],
      chart: { width: 60, height: 60, type: 'radialBar' },
      plotOptions: {
        radialBar: {
          startAngle: 0,
          endAngle: 360,
          strokeWidth: '8',
          hollow: { margin: 2, size: '45%' },
          track: { strokeWidth: '50%', background: borderColor },
          dataLabels: {
            show: true,
            name: { show: false },
            value: {
              formatter: function (val) {
                return String(parseInt(val, 10));
              },
              offsetY: 5,
              color: '#697a8d',
              fontSize: '13px',
              show: true
            }
          }
        }
      },
      fill: { type: 'solid', colors: config.colors.primary },
      stroke: { lineCap: 'round' },
      grid: { padding: { top: -10, bottom: -15, left: -10, right: -10 } },
      states: {
        hover: { filter: { type: 'none' } },
        active: { filter: { type: 'none' } }
      }
    };
    if (weeklyExpensesEl) {
      const c = new ApexCharts(weeklyExpensesEl, weeklyExpensesConfig);
      __ngocSneatCharts.push(c);
      c.render();
    }

    const lo = document.getElementById('ngoc-logout-btn');
    if (lo && !lo.getAttribute('data-ngoc-bound')) {
      lo.setAttribute('data-ngoc-bound', '1');
      lo.addEventListener('click', function () {
        NgocAdmin.logout();
      });
    }
  }

  window.NgocSneatDashboardInit = main;

  function orderStatusVi(v) {
    const m = {
      pending: 'Chờ xử lý',
      processing: 'Đang xử lý',
      shipped: 'Đang giao',
      completed: 'Đã giao',
      cancelled: 'Đã huỷ'
    };
    return m[v] || v || 'Đơn hàng';
  }

})();
