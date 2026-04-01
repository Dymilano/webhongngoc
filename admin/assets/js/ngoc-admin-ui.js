(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.NgocAdminUi = {
    escapeHtml: escapeHtml,
    money: function (n) {
      try {
        return Number(n || 0).toLocaleString('vi-VN') + ' ₫';
      } catch (_) {
        return String(n) + ' ₫';
      }
    },
    orderStatus: function (v) {
      const m = {
        pending: 'Chờ xử lý',
        processing: 'Đang xử lý',
        shipped: 'Đang giao',
        completed: 'Đã giao',
        cancelled: 'Đã huỷ'
      };
      return m[v] || v || '—';
    },
    paymentMethod: function (v) {
      return v === 'bank' ? 'Chuyển khoản' : v === 'cod' ? 'COD' : v || '—';
    },
    paymentStatus: function (v) {
      const m = { unpaid: 'Chưa thanh toán', paid: 'Đã thanh toán', refunded: 'Hoàn tiền' };
      return m[v] || v || '—';
    },
    /** Badge class for order status */
    statusBadgeClass: function (v) {
      const m = {
        pending: 'bg-label-warning',
        processing: 'bg-label-info',
        shipped: 'bg-label-primary',
        completed: 'bg-label-success',
        cancelled: 'bg-label-danger'
      };
      return m[v] || 'bg-label-secondary';
    }
  };
})();
