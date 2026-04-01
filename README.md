# Ngoc's Clothes — Website bán hàng + Admin + API

Website thương mại điện tử (shop) kèm trang quản trị (admin) và hệ thống API backend dùng chung cho cả 2 cổng.
Phù hợp làm đồ án, public GitHub và onboarding dev mới.


## 2. Công nghệ sử dụng

### Frontend

- **Shop**: HTML/CSS/JS (static site) trong `website/`
- **Admin**: HTML/JS template (static) trong `admin/` (gọi API qua `fetch`)

### Backend

- **Node.js + Express**: API + static serving (2 cổng: shop/admin)
- **Auth**: JWT access token + refresh token cookie (HttpOnly)

### Database

- **MySQL** (khuyến nghị production) hoặc **SQLite** (dev nhanh)
- Tự migrate nhẹ khi chạy server (xem `server/lib/db.js`)

### Thư viện chính

- `express`, `cors`
- `bcryptjs` (hash password)
- `jsonwebtoken` (JWT)
- `helmet` (hardening HTTP headers)
- `express-rate-limit` (limit brute force auth)
- `multer` (upload media/avatar)
- `mysql2` / `sqlite` + `sqlite3`

## 3. Chức năng chính

### Người dùng (User)

- **Đăng ký / Đăng nhập / Đăng xuất**
  - API: `/api/auth/*`
  - Shop dùng form modal và lưu access token phía client
- **Quản lý Profile**
  - Xem/cập nhật thông tin cá nhân
  - Cập nhật địa chỉ liên hệ
  - Upload avatar
  - Trang: `GET /profile/`

### Quản trị (Admin)

- **Đăng nhập admin** và phân quyền theo role (`user/staff/admin/super_admin`)
- **CRUD dữ liệu**:
  - Sản phẩm, danh mục
  - Đơn hàng
  - Người dùng
  - CMS, review, coupon, settings…

## 4. Cài đặt và chạy project

### 4.1. Clone repo

```bash
git clone <your-repo-url>
cd thoitrang
```

### 4.2. Cài dependencies (backend)

```bash
cd server
npm install
```

### 4.3. Cấu hình environment

Tạo file `server/.env` từ mẫu:

```bash
copy .env.example .env
```

Các biến quan trọng:

- `PORT_SHOP=5000` / `PORT_ADMIN=5050`
- `USE_DB=1` để bật DB
- `DB_DIALECT=mysql` hoặc `sqlite`
- `JWT_SECRET` (bắt buộc dùng chuỗi mạnh khi deploy)
- `JWT_ACCESS_EXPIRES` (mặc định `15m` nếu không set)
- `JWT_REFRESH_DAYS` (mặc định `30`)

### 4.4. Chạy database

#### Option A — MySQL bằng Docker (khuyến nghị)

Ở thư mục root:

```bash
docker compose up -d
```

Import schema:

```bash
cd server
mysql -u root -proot ngoc_clothes < schema.sql
```

#### Option B — SQLite (dev nhanh)

Trong `server/.env`:

```env
USE_DB=1
DB_DIALECT=sqlite
SQLITE_PATH=./data/ngocclothes.sqlite
```

### 4.5. (Optional) Seed dữ liệu

```bash
cd server
npm run seed
```

### 4.6. Chạy web

```bash
cd server
npm start
```

Mở:

- **Shop + API**: `http://127.0.0.1:5000/` (API ở `http://127.0.0.1:5000/api`)
- **Admin**: `http://127.0.0.1:5050/`
- **Profile**: `http://127.0.0.1:5000/profile/`

## 5. Cấu trúc thư mục

```
thoitrang/
  admin/                 # Giao diện admin (static)
  website/               # Giao diện shop (static)
    assets/js/           # JS custom (auth, profile, ...)
    profile/             # Trang hồ sơ cá nhân
    uploads/             # Ảnh upload (media/avatar)
  server/                # Backend Node.js/Express
    routes/              # Các route API
    middleware/          # Auth/role middleware
    lib/                 # DB adapter + migration nhẹ
    schema.sql           # Schema MySQL (tham khảo/khởi tạo)
```

## 6. API chính

Base API: `http://127.0.0.1:5000/api` (shop) hoặc `http://127.0.0.1:5050/api` (admin)

### 6.1. Auth API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/entry` (endpoint “1 nút” dùng cho shop)

### 6.2. Profile API

> Tất cả endpoint dưới đây yêu cầu `Authorization: Bearer <accessToken>`

- `GET /api/profile`
- `PUT /api/profile`
- `PUT /api/profile/address`
- `POST /api/profile/avatar` (multipart form-data, field `avatar`)

### 6.3. Admin API (tiêu biểu)

> Các route quản trị yêu cầu role `admin/staff/super_admin`

- `GET/POST/PUT/DELETE /api/products`
- `GET/POST/PUT/DELETE /api/categories`
- `GET/PATCH /api/orders`
- `GET/POST/PUT/DELETE /api/users`
- `GET/PUT /api/settings`

## 7. Hình ảnh minh hoạ

Bạn có thể đặt screenshot vào `docs/screenshots/` và cập nhật link tại đây:

- Login/Register: `docs/screenshots/login.png`
- Profile: `docs/screenshots/profile.png`
- Admin: `docs/screenshots/admin.png`

## 8. Tài khoản test

### Admin (khi seed)

- **Email**: `admin@ngoc.local`
- **Password**: `Admin@123`

### User demo (mặc định)

- **Email**: `testuser@example.com`
- **Password**: `Test@1234`

> Nếu bạn chưa có user demo trong DB, hãy đăng ký nhanh tại `http://127.0.0.1:5000/my-account/` rồi dùng tài khoản đó.

## 9. Hướng phát triển

- **Bảo mật**:
  - Bắt buộc `JWT_SECRET` khi `NODE_ENV=production`
  - Thêm policy password mạnh, lock account sau N lần sai
  - Tách đổi email / đổi mật khẩu thành flow riêng có verify
- **Profile**:
  - Hỗ trợ nhiều địa chỉ (user_addresses table)
  - Mặc định địa chỉ giao hàng, địa chỉ thanh toán
- **UI/UX**:
  - Đồng bộ UI profile theo theme shop
  - Thêm trang “Đơn hàng của tôi”


- **Liên hệ**: <0349729139>

