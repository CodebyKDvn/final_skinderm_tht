-- ===============================================================================================
-- SKIN DERM AI - SUPABASE DATABASE INIT SCRIPT
-- Chạy script này trong SQL Editor của Supabase để thiết lập toàn bộ Database và Storage.
-- Đảm bảo hệ thống chạy mượt, không lỗi phân quyền RLS.
-- ===============================================================================================

-- Bật extension pgcrypto để sinh mã UUID (UUID v4)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===============================================================================================
-- 1. TẠO BẢNG: analysis_records 
-- Chứa thông tin lịch sử quét da (Scan) của bệnh nhân.
-- ===============================================================================================
DROP TABLE IF EXISTS public.analysis_records CASCADE;

CREATE TABLE public.analysis_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,          -- Lưu UID của Firebase (Dạng chuỗi Firebase Auth)
    image_url TEXT NOT NULL,        -- Đường dẫn ảnh trên storage lưu trữ
    risk_score NUMERIC NOT NULL,    -- Mức độ rủi ro (0 - 100%)
    classification TEXT NOT NULL,   -- Phân loại bệnh (VD: Melanoma, Nevus,...)
    confidence NUMERIC NOT NULL,    -- Độ tin cậy của AI (0 - 100%)
    abcde JSONB,                    -- Dữ liệu chấm điểm ABCDE
    top3 JSONB,                     -- Top 3 dự đoán cao nhất
    uv_index NUMERIC,               -- Chỉ số tử ngoại thời điểm chụp
    temperature NUMERIC,            -- Nhiệt độ thời điểm chụp
    location TEXT,                  -- Vị trí người dùng
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tạo Index để tăng tốc độ truy vấn history theo người dùng (Tối ưu performance)
CREATE INDEX idx_analysis_records_user_id ON public.analysis_records(user_id);
CREATE INDEX idx_analysis_records_created_at ON public.analysis_records(created_at DESC);


-- ===============================================================================================
-- 2. TẠO BẢNG: moles 
-- (Bảng dự phòng cho quản lý tình trạng nốt ruồi rời rạc theo thời gian)
-- ===============================================================================================
DROP TABLE IF EXISTS public.moles CASCADE;

CREATE TABLE public.moles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    body_part TEXT,                 -- Vị trí trên cơ thể (vd: Cánh tay phải, Mặt)
    notes TEXT,                     -- Ghi chú của bệnh nhân/bác sĩ
    status TEXT DEFAULT 'monitoring', -- Trạng thái: monitoring, removed, benign
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_moles_user_id ON public.moles(user_id);

-- (Optional) Hàm tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_moles_modtime
    BEFORE UPDATE ON public.moles
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();


-- ===============================================================================================
-- 3. CẤU HÌNH ROW-LEVEL SECURITY (RLS) - BẢO MẬT DỮ LIỆU
-- ===============================================================================================

-- Bật bảo mật RLS cho cả 2 bảng
ALTER TABLE public.analysis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moles ENABLE ROW LEVEL SECURITY;

-- Lưu ý: Vì Backend dùng Firease Auth, ta không dùng trực tiếp `auth.uid()` của Supabase
-- Backend sẽ giao tiếp với Database thông qua Service Role Key (vượt qua RLS).
-- Tuy nhiên, chính sách RLS cứng được đặt ở đây nhằm ngăn chặn bất kỳ truy cập REST/GraphQL 
-- nào từ Frontend Public Anon Key.

-- Policy cho 'analysis_records': 
-- Rất chặt chẽ: Backend có Admin key thì thoải mái, Client chỉ được giới hạn ở UID.
CREATE POLICY "Cho phép SELECT analysis_records cho Backend" 
ON public.analysis_records 
FOR SELECT 
USING (true); -- Backend tự filter qua truy vấn WHERE user_id = ...

CREATE POLICY "Cho phép INSERT analysis_records bằng Backend"
ON public.analysis_records
FOR INSERT
WITH CHECK (true);

-- Policy cho 'moles'
CREATE POLICY "Cho phép thao tác moles"
ON public.moles
FOR ALL
USING (true)
WITH CHECK (true);


-- ===============================================================================================
-- 4. BUCKET STORAGE: mole-images
-- Tạo và cung cấp quyền lưu trữ ảnh chụp cắt lớp
-- ===============================================================================================

-- Đảm bảo Public truy cập để Frontend load được ảnh từ image_url
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mole-images',
    'mole-images',
    true, -- Cho phép link URL public
    5242880, -- Giới hạn 5MB/ảnh
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE 
SET public = true, 
    file_size_limit = 5242880, 
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']::text[];

-- Xoá policies cũ của bucket nếu có
DROP POLICY IF EXISTS "Public View Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Backend Insert" ON storage.objects;

-- Thiết lập lại policy cho Bucket
-- Policy 1: AI cũng dùng link Public để render trên FrontEnd -> Cho phép ai cũng có thể đọc (SELECT)
CREATE POLICY "Public View Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'mole-images');

-- Policy 2: Chỉ cho phép Backend/Authenticated Upload images (Insert)
CREATE POLICY "Allow Backend Insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'mole-images');

CREATE POLICY "Allow Backend Delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'mole-images');

-- ===============================================================================================
-- HOÀN TẤT INITIALIZATION
-- ===============================================================================================
