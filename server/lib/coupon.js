function normalizeCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

function rowToCoupon(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    min_order: row.min_order != null ? Number(row.min_order) : 0,
    max_uses: row.max_uses != null ? Number(row.max_uses) : null,
    used_count: Number(row.used_count || 0),
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    active: Number(row.active) === 1
  };
}

function computeDiscount(subtotal, coupon) {
  const err = (msg) => ({ ok: false, error: msg });
  if (!coupon || !coupon.active) return err('Mã không hợp lệ hoặc đã tắt');
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return err('Mã chưa có hiệu lực');
  if (coupon.ends_at && new Date(coupon.ends_at) < now) return err('Mã đã hết hạn');
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) return err('Mã đã hết lượt');
  if (subtotal < coupon.min_order) return err(`Đơn tối thiểu ${coupon.min_order} đ`);

  let discount = 0;
  if (coupon.discount_type === 'percent') {
    discount = subtotal * (coupon.discount_value / 100);
  } else {
    discount = Math.min(subtotal, coupon.discount_value);
  }
  discount = Math.round(discount * 100) / 100;
  const finalSubtotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  return { ok: true, discount, final_subtotal: finalSubtotal };
}

module.exports = { normalizeCode, rowToCoupon, computeDiscount };
