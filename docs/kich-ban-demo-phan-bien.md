# KỊCH BẢN DEMO BUỔI PHẢN BIỆN ĐỒ ÁN TỐT NGHIỆP

**Đề tài:** Sàn thương mại điện tử đa nhà bán hàng hiệu năng cao — **Lumière**
**Thời lượng demo mục tiêu:** 12–15 phút (chưa kể hỏi đáp)
**Nguyên tắc xây dựng kịch bản:** Thầy phản biện đã đọc rất kỹ quyển đồ án → mọi thao tác demo đều phải **gọi tên đúng khái niệm, đúng số liệu, đúng mục/hình/bảng đã viết trong quyển**. Không demo tính năng nào không có trong quyển; không nói số liệu nào lệch với quyển.

---

## PHẦN 0 — BA THÔNG ĐIỆP CỐT LÕI (học thuộc)

Toàn bộ buổi demo xoay quanh đúng 3 đóng góp đã cam kết ở **Tóm tắt nội dung** và **Chương 5**. Nếu bị cắt ngắn thời gian, ưu tiên demo theo thứ tự này:

1. **Giữ kho nguyên tử + Idempotency Key** (Mục 5.1) — triệt tiêu oversell và đơn trùng, đã kiểm chứng bằng k6: **0.00% oversell dưới 250 request đồng thời** (Bảng 4.9 — kết quả kiểm thử tải).
2. **Voucher Engine phân tầng 4 lớp tính hoàn toàn tại backend** (Mục 5.3) — chống sửa giá từ client, tách đơn theo vendor, hoa hồng sàn 10%.
3. **Gợi ý sản phẩm lai có suy hao thời gian** (Mục 5.2) — 9 loại hành vi, công thức `Score_raw × e^(−Δt/30)`, fallback cho Cold Start.

> Câu chốt dùng xuyên suốt: *"Điểm khác biệt của đồ án không phải là làm một website bán hàng, mà là giải 3 bài toán mà em đã chỉ ra ở Mục 1.2 rằng các nền tảng hiện có chưa giải quyết công khai: nhất quán tồn kho dưới tải cao, xác thực đa vai trò an toàn, và cá nhân hóa theo thời gian thực."*

---

## PHẦN 1 — CHECKLIST CHUẨN BỊ TRƯỚC BUỔI DEMO (làm từ hôm trước + 30 phút trước giờ G)

Danh sách này đối chiếu từ `docs/demo-risks-vi.md` — chỉ giữ các mục bắt buộc:

### 1.1. Hạ tầng
- [ ] MongoDB + **Redis đang chạy** (Redis bắt buộc — rate-limit và session là điểm nhấn bảo mật của Chương 3.3; fallback in-memory chỉ là dự phòng dev, đừng để thầy hỏi "Redis đâu?").
- [ ] Backend `:4000`, frontend shop `:5173`, vendor dashboard `:5174` — mở sẵn 2 cửa sổ trình duyệt cạnh nhau (1 buyer, 1 vendor) để demo realtime.
- [ ] Nếu demo Stripe: bật **Cloudflare Tunnel** trỏ vào cổng 4000 và cấu hình webhook endpoint `/api/order/stripe-webhook` từ trước; test 1 giao dịch hoàn chỉnh sáng hôm demo. **Nếu tunnel/webhook không chắc chắn → chuyển sang phương án COD + giải thích luồng webhook trên slide** (xem Phần 3, Tình huống B).
- [ ] `k6` đã cài (`k6 version`), file `thesis/run_load_test.sh` đã điền sẵn `PRODUCT_ID` + `TOKEN` còn hạn, và **đã chạy thử thành công 1 lần**. Giữ sẵn kết quả lần chạy trước ở `/tmp/k6_scenario1.txt` làm bằng chứng dự phòng.

### 1.2. Dữ liệu demo (seed từ hôm trước, kiểm tra lại trước giờ G)
- [ ] 2 tài khoản: `buyer-demo` (đã verify email, có lịch sử tương tác vài sản phẩm thời trang để phần gợi ý "có gì để nói") và `vendor-demo` (đã đăng ký gian hàng, có sản phẩm + đơn hàng + doanh thu để dashboard không trống).
- [ ] 1 tài khoản `user-moi` **chưa từng tương tác** — để demo Cold Start fallback.
- [ ] 1 sản phẩm "demo oversell" tồn kho thấp (stock = 20) dành riêng cho k6 — không dùng chung với sản phẩm demo mua hàng.
- [ ] **Voucher mỗi loại ít nhất 2 mã còn nhiều lượt** (SHOP / PLATFORM / SHIPPING) — rủi ro 4.1 trong demo-risks: voucher hết lượt giữa demo. Chuẩn bị thêm 1 voucher SHOP **của shop khác** để demo ca "từ chối kèm lý do".
- [ ] Địa chỉ giao hàng đã lưu sẵn trong address book của `buyer-demo` (tránh nhập form tỉnh/phường phụ thuộc API ngoài — rủi ro 4.4/4.5).
- [ ] Giỏ hàng buyer-demo để **trống** trước khi demo (tránh item cũ `isActive=false`).

### 1.3. Phòng hờ
- [ ] Chụp/quay sẵn: kết quả k6 hai kịch bản, màn hình Stripe checkout thành công, đơn bị sweeper hủy hoàn kho. Nếu mạng/dịch vụ ngoài chết thì chiếu lại và giải thích.
- [ ] Mở sẵn quyển đồ án PDF ở các trang: Hình kiến trúc tổng thể (4.1), biểu đồ tuần tự tạo đơn + giữ kho (Hình 2.x), Bảng kết quả k6 (4.9), công thức time decay (Chương 5.2).
- [ ] Terminal mở sẵn tab: log backend (nhìn thấy log sweeper mỗi 60s), tab chạy k6, tab `mongosh` để show tồn kho trực tiếp nếu thầy yêu cầu.

---

## PHẦN 2 — KỊCH BẢN CHI TIẾT THEO TIMELINE

Mỗi phân đoạn gồm: **[Thao tác]** trên màn hình — **[Script]** lời thoại đầy đủ — **[Bám đồ án]** trỏ về đúng chỗ trong quyển (để khi thầy hỏi sâu, trả lời "em đã trình bày ở mục…").

---

### ĐOẠN 1 — Mở đầu & đặt vấn đề (1 phút, không thao tác)

**[Script]**
> "Em xin phép demo hệ thống Lumière — sàn thương mại điện tử đa nhà bán hàng em đã trình bày trong quyển. Trước khi vào demo, em xin nhắc lại 3 hạn chế của các nền tảng hiện có mà em đã khảo sát ở Chương 1 và Chương 2: **thứ nhất**, không nền tảng nào công khai cơ chế đảm bảo nhất quán tồn kho dưới tải cao — hệ quả là lỗi oversell trong Flash Sale; **thứ hai**, mô hình xác thực cho người dùng đa vai trò — vừa là người mua vừa là người bán — chưa được xử lý bài bản; **thứ ba**, gợi ý sản phẩm dựa trên lịch sử tĩnh, không phản ánh xu hướng người dùng theo thời gian.
>
> Buổi demo hôm nay em sẽ đi theo đúng luồng nghiệp vụ của một khách hàng: đăng nhập → tìm kiếm và xem gợi ý → đặt hàng với voucher nhiều lớp → thanh toán → và phần quan trọng nhất là **kiểm chứng trực tiếp cơ chế chống oversell bằng công cụ k6** với đúng kịch bản em đã báo cáo ở Chương 4. Song song em mở sẵn dashboard nhà bán hàng để hội đồng thấy thông báo thời gian thực."

**[Bám đồ án]** Mục 1.1–1.2 (ba hạn chế), Mục 1.3 (định hướng giải pháp MERN + Redis + Socket.IO).

---

### ĐOẠN 2 — Kiến trúc hệ thống (1,5 phút, chiếu hình trong quyển hoặc slide)

**[Thao tác]** Chiếu Hình kiến trúc triển khai tổng thể (Hình 4.1 trong quyển).

**[Script]**
> "Kiến trúc hệ thống như em trình bày ở Mục 4.1: hai ứng dụng React độc lập — shop cho người mua chạy React 19 + Vite, vendor dashboard cho nhà bán hàng — cùng gọi về một backend Express 5 trên cổng 4000. Backend là **monolith phân lớp 4 tầng: routes → controllers → services → models**, phụ thuộc một chiều từ ngoài vào trong. Em chủ động **không chọn microservices** và đã biện luận trong quyển: phạm vi một cụm máy chủ, monolith phân lớp đơn giản hóa giao dịch nguyên tử giữa đặt hàng và giữ kho, và vẫn đủ tách biệt để tách dịch vụ sau này.
>
> Về dữ liệu: MongoDB là kho chính, **Redis đảm nhận hai việc — rate-limiting cho API nhạy cảm và quản lý phiên xác thực phía server phục vụ refresh token rotation**. Kênh thời gian thực tách làm hai đúng theo bản chất dữ liệu: **Socket.IO cho chat hai chiều**, còn **Server-Sent Events cho thông báo đẩy một chiều** tới vendor dashboard. Thanh toán tích hợp Stripe cho quốc tế và VNPay cho nội địa, ảnh sản phẩm lưu trên Cloudflare R2 có nén bằng Sharp."

**[Bám đồ án]** Mục 4.1.1 (4 tầng + lý do không microservices), Mục 4.1.2 (Hình 4.1), Mục 2.4 yêu cầu kỹ thuật (vì sao SSE ≠ Socket.IO — thầy hay hỏi; trả lời chi tiết có ở Mục 3.2.2).

**Câu hỏi dễ gặp ngay tại đây:**
- *"Sao không dùng WebSocket cho cả thông báo?"* → SSE đủ cho đẩy một chiều, nhẹ hơn, tự reconnect qua HTTP; WebSocket chỉ dành cho chat cần hai chiều (Mục 3.2.2).
- *"Monolith thì scale kiểu gì?"* → trả lời theo Chương 6: Redis Pub/Sub tập trung hóa SSE + message queue, đã nêu ở hướng phát triển.

---

### ĐOẠN 3 — Xác thực hợp nhất User/Vendor + Rate-limit (2 phút)

**[Thao tác]**
1. Đăng nhập `buyer-demo` bằng email/mật khẩu.
2. Mở DevTools → tab Application → chỉ vào cookie `HttpOnly`.
3. (Tùy thời gian) Nhập sai mật khẩu liên tiếp 5–6 lần trên một tài khoản phụ → hiện lỗi 429.

**[Script]**
> "Đầu tiên là phân hệ xác thực — ca sử dụng số 1 em đặc tả ở Bảng 2.2. Em đăng nhập bằng tài khoản người mua. Điểm thiết kế thứ nhất: **token truy cập và token làm mới đều nằm trong cookie HttpOnly**, JavaScript không đọc được, chống XSS đánh cắp token. Phía server, mỗi phiên có bản ghi trong Redis phục vụ **refresh token rotation** — mỗi lần làm mới, token cũ bị vô hiệu qua danh sách đen thời gian thực; nếu kẻ tấn công dùng lại token cũ, toàn bộ phiên bị thu hồi.
>
> Điểm thứ hai: nếu em cố tình nhập sai mật khẩu nhiều lần — [thao tác] — hệ thống trả về **HTTP 429 kèm thời gian chờ**, vì mọi API nhạy cảm như đăng nhập, xác minh email, quên mật khẩu đều bị **giới hạn tần suất theo cả IP lẫn email trên Redis**. Em dùng Redis chứ không đếm in-memory vì bộ đếm phải sống qua restart và chia sẻ được giữa nhiều tiến trình khi scale ngang.
>
> Điểm thứ ba là **mô hình tài khoản hợp nhất**: đây cũng chính là tài khoản có thể nâng cấp thành nhà bán hàng — không tạo tài khoản mới, chỉ bổ sung thông tin shop và trường `role` chuyển thành `vendor`. Em đặc tả luồng này ở Phụ lục B.1."

**[Bám đồ án]** Bảng đặc tả UC1 (Mục 2.3.1) — chú ý chi tiết đã viết: lỗi trả về là *"Invalid credentials"* chung chung để chống dò tài khoản; Mục 3.3 (Redis rate-limit + session); Phụ lục B.1 (Vendor Registration, lỗi 409 khi trùng tên shop).

---

### ĐOẠN 4 — Tìm kiếm lai + Gợi ý cá nhân hóa có suy hao thời gian (2,5 phút)

**[Thao tác]**
1. Gõ vào thanh tìm kiếm **không dấu**, ví dụ `ao khoac` → autocomplete hiện sản phẩm "Áo khoác…".
2. Nhấp vào thanh tìm kiếm trống → chỉ vào "Tìm kiếm thịnh hành".
3. Mở 2–3 trang sản phẩm cùng danh mục, thêm 1 cái vào giỏ → quay về trang chủ → chỉ vào khu gợi ý đã thay đổi.
4. (Nếu còn thời gian) đăng nhập `user-moi` ở tab ẩn danh → trang chủ vẫn đầy sản phẩm (fallback).

**[Script]**
> "Tiếp theo là hai cơ chế em trình bày ở Mục 5.4 và 5.2. Em gõ 'ao khoac' **không dấu** — hệ thống vẫn tìm đúng 'Áo khoác'. Lý do: em dùng **chiến lược tìm kiếm kép** — giai đoạn 1 là Text Index của MongoDB với trọng số name ×10, brand ×5, tags ×3; giai đoạn 2 là **Regex fallback trên chuỗi đã chuẩn hóa bỏ dấu** bằng hàm normalizeText, bắt các trường hợp khớp một phần mà text index bỏ sót. Kết quả xếp hạng theo công thức 4 thành phần đã chuẩn hóa về [0,1]: **0.4 điểm khớp văn bản + 0.3 doanh số + 0.2 đánh giá + 0.1 điểm tương tác cá nhân của chính người dùng này** — tức là hai người khác nhau tìm cùng từ khóa có thể thấy thứ tự khác nhau.
>
> Mỗi truy vấn được ghi **bất đồng bộ fire-and-forget** vào collection searchanalytics — không thêm độ trễ cho người dùng — và tích lũy thành mục 'Tìm kiếm thịnh hành' ở đây.
>
> Về gợi ý trang chủ: em vừa xem và thêm giỏ vài sản phẩm — quay lại trang chủ, danh sách gợi ý đã cập nhật theo. Cơ chế phía sau là **9 loại hành vi được chấm điểm** — mua hàng nặng nhất 10 điểm, xem trang 1 điểm, thời gian xem 0.01 điểm/giây — cộng thành điểm thô, rồi **nhân hệ số suy hao e^(−Δt/30)**: sau 30 ngày không tương tác, điểm còn khoảng 36,8%. Hằng số 30 ngày em lấy theo nghiên cứu về collaborative filtering có time decay đã trích dẫn trong quyển. Danh sách cuối là **trộn hai nhánh**: lọc cộng tác user-based bằng cosine similarity trên top-20 người dùng tương đồng chiếm nửa đầu, lọc theo nội dung lấp phần còn lại, và **fallback sản phẩm phổ biến** cho người dùng mới — đây là cách em xử lý Cold Start."

**[Bám đồ án]** Mục 5.4 (dual search, trọng số 10/5/3, công thức finalScore w=0.4/0.3/0.2/0.1), Mục 5.2 + Bảng trọng số hành vi (purchased=10 … timeSpent=0.01/s), công thức (5.2)–(5.4), Mục 3.4 (cơ sở lý thuyết CF/CBF + trích dẫn time-decay).

**Câu hỏi dễ gặp:** *"Sao chọn λ=1/30?"* → tham khảo nghiên cứu time-decay CF (đã cite); trong quyển em cũng ghi rõ đây là tham số sẽ tinh chỉnh khi đủ dữ liệu thật — trả lời đúng như vậy, đừng nói cứng "tối ưu nhất".

---

### ĐOẠN 5 — Checkout: Voucher Engine 4 lớp + Preview backend (3 phút) ⭐ trọng tâm 1

**[Thao tác]**
1. Vào giỏ hàng có sản phẩm **từ 2 shop khác nhau** → bấm checkout.
2. Nhập lần lượt: 1 voucher SHOP hợp lệ, 1 voucher PLATFORM, 1 voucher SHIPPING → bảng kê cập nhật từng dòng.
3. Nhập voucher SHOP **của shop không có trong đơn** → hiện từ chối kèm lý do.
4. Mở DevTools → Network → chỉ vào request preview: client chỉ gửi danh sách sản phẩm + mã voucher, **không gửi giá**.

**[Script]**
> "Đây là phần em coi là đóng góp thứ hai — Mục 5.3. Giỏ hàng của em có sản phẩm từ **hai cửa hàng khác nhau** — đúng đặc thù multi-vendor. Khi em nhập các mã giảm giá, mọi con số trên bảng kê này **không tính ở client**: client chỉ gửi danh sách sản phẩm và mã voucher lên API preview, backend tải giá gốc từ cơ sở dữ liệu rồi chạy qua **4 bước tuần tự cố định**: một — tính subtotal theo từng shop; hai — áp **Shop Voucher** trên subtotal của đúng shop đó, có kiểm tra đơn tối thiểu và trần giảm tối đa; ba — áp **Platform Voucher** trên tổng đã trừ giảm giá shop; bốn — áp **Shipping Voucher** vào phí vận chuyển, ra FinalTotal.
>
> Thứ tự này không đổi được: nếu áp voucher sàn trước voucher shop, cơ sở tính phần trăm sẽ sai và sàn chịu thiệt — em phân tích điều này trong quyển. Mỗi loại bị giới hạn: **1 voucher shop mỗi nhà bán, 1 voucher sàn và 1 voucher ship mỗi đơn** — đây chính là các ca kiểm thử 7, 8, 9 trong bảng 11 test case của VoucherService, **11/11 đạt**.
>
> Bây giờ em nhập một voucher shop nhưng của cửa hàng khác — hệ thống **từ chối kèm lý do cụ thể** chứ không im lặng, đúng luồng ngoại lệ em đặc tả ở ca sử dụng số 3. Và như hội đồng thấy trong tab Network — payload **không hề chứa giá tiền**; kể cả người dùng sửa request, backend vẫn tính lại từ dữ liệu gốc, loại bỏ hoàn toàn tấn công sửa giá."

**[Bám đồ án]** Mục 5.3.2 + Hình quy trình 4 bước (TikZ) + 4 công thức; đặc tả UC3 (Bảng 2.4); Bảng test VoucherService 11 ca (Mục 4.4) — nhớ đúng ví dụ trong quyển: *đơn 400.000đ, SHOP 15% + PLATFORM 20k + FREESHIP 25k → còn 355.000đ* (TC4); cấu trúc `pricing` nhúng trong order (Bảng schema orders); commission sàn mặc định 10% trong mảng `vendors`.

---

### ĐOẠN 6 — Đặt hàng: Idempotency + giữ kho TTL + thanh toán online (2,5 phút) ⭐ trọng tâm 2

**[Thao tác]**
1. Bấm "Đặt hàng" chọn **Stripe** (nếu webhook đã chắc chắn) hoặc **COD** (phương án an toàn).
2. Với Stripe: thanh toán bằng thẻ test `4242 4242 4242 4242` → quay về, đơn chuyển "đã thanh toán"; **đồng thời chỉ sang màn hình vendor bên cạnh: thông báo đơn mới hiện realtime**.
3. Chỉ vào terminal log backend: dòng log sweeper chạy chu kỳ 60s.

**[Script]**
> "Khi em bấm Đặt hàng, client sinh một **UUID v4 làm idempotencyKey** gửi kèm request. Trong MongoDB, collection orders có **chỉ mục duy nhất kết hợp trên cặp userId + idempotencyKey** — nếu em bấm đúp hoặc mạng gửi lại request, yêu cầu thứ hai đâm vào lỗi trùng khóa 11000, backend bắt lỗi này và **trả lại chính đơn đã tạo** thay vì tạo đơn mới. Đây là ca kiểm thử thủ công số 2 trong Bảng kiểm thử của em: gửi lại request cũ → không phát sinh đơn trùng.
>
> Vì em chọn thanh toán online, tồn kho được **giữ chỗ có thời hạn 15 phút** — đơn ghi hai mốc stockReservedAt và reservationExpiresAt. Nếu em bỏ ngang không thanh toán, **tác vụ nền quét mỗi 60 giây** sẽ tìm các đơn quá hạn, hoàn tồn kho bằng lệnh cập nhật nguyên tử, khôi phục lượt voucher và chuyển đơn sang Cancelled — hội đồng có thể thấy log chu kỳ quét ở terminal này. Luồng này em vẽ ở biểu đồ tuần tự 'tác vụ nền xử lý hủy đơn quá hạn' trong Chương 2.
>
> Kết quả thanh toán Stripe được xác nhận **qua webhook chứ không qua redirect** — vì redirect có thể không bao giờ xảy ra nếu người dùng đóng trình duyệt; webhook có chữ ký để backend xác minh, và endpoint này em phải mount **trước express.json()** để giữ nguyên raw body phục vụ xác minh chữ ký — chi tiết này em ghi ở Mục 4.5 Triển khai. Và như hội đồng thấy màn hình bên phải — **vendor nhận thông báo đơn mới ngay lập tức qua SSE**, không cần tải lại trang."

**[Bám đồ án]** Mục 5.1.2 (idempotency + code index trong quyển), Mục 5.1.1 (TTL 15 phút, cron 60s, query sweeper in nguyên văn trong quyển), Hình tuần tự payment sweeper (Chương 2), Bảng kiểm thử thủ công 4 kịch bản (Mục 4.4), Mục 4.5 (webhook trước express.json, VNPay callback chữ ký số → redirect `/verify`).

**Tình huống B (không demo được Stripe):** đặt COD, nói: *"COD đơn ghi nhận trạng thái Đã đặt hàng ngay; với Stripe/VNPay luồng như em vừa mô tả — em xin phép chiếu ảnh giao dịch Stripe em chạy sáng nay kèm log webhook"* → chiếu ảnh chuẩn bị sẵn. Không cố demo trực tiếp khi chưa test tunnel.

---

### ĐOẠN 7 — Kiểm chứng chống oversell bằng k6 (2,5 phút) ⭐ trọng tâm 3, điểm nhấn mạnh nhất

**[Thao tác]**
1. Mở terminal, chạy `./thesis/run_load_test.sh` (hoặc chỉ scenario 1 cho nhanh: 100 VUs / kho 20).
2. Trong lúc k6 chạy (~12s), nói phần cơ chế.
3. Kết quả hiện ra: đọc to 3 con số — **20 đơn thành công, 80 bị từ chối OUT_OF_STOCK, tồn kho cuối = 0**.
4. (Nếu thầy muốn) mở `mongosh` query nhanh stock của sản phẩm → đúng 0, không âm.

**[Script]**
> "Đây là phần em muốn kiểm chứng trực tiếp trước hội đồng — đúng kịch bản k6 em báo cáo ở Mục 4.4. Em bắn **100 request đặt hàng đồng thời, cùng một startTime, vào một sản phẩm chỉ còn 20 tồn kho** — mô phỏng Flash Sale.
>
> Trong lúc chạy, em giải thích cơ chế: hệ thống truyền thống đọc-kiểm tra-rồi-ghi bằng hai truy vấn riêng, nên hai request cùng đọc 'còn 1' sẽ cùng trừ và kho âm. Giải pháp của em là **gộp kiểm tra và trừ kho vào một lệnh ghi nguyên tử duy nhất**: điều kiện `stock >= quantity` nằm ngay trong filter của updateOne, kèm `$inc` trừ đồng thời cả tổng kho lẫn kho biến thể qua arrayFilters. MongoDB khóa cấp tài liệu tuần tự hóa các lệnh ghi — request nào đến khi kho đã cạn thì filter không khớp, `modifiedCount = 0`, hệ thống trả OUT_OF_STOCK ngay. Nó tương đương optimistic locking nhưng không cần quản lý version. Đây cũng là lý do em chọn MongoDB: **biến thể nằm trong mảng nhúng nên một lệnh `$inc` cập nhật được cả hai mức kho, không cần JOIN hay transaction đa bảng** — em so sánh với RDBMS ở Bảng 3.1.
>
> [Kết quả hiện] Và đây: **đúng 20 đơn thành công — bằng đúng tồn kho, 80 request bị từ chối, tồn kho cuối trong DB bằng 0, oversell 0,00%** — khớp với Bảng kết quả trong quyển. Ở kịch bản tải cao 250 request/kho 50 em đã chạy và báo cáo: cũng 0,00% oversell, throughput 19,93 request/giây, chứng tỏ event loop của Node.js chịu tải I/O đồng thời tốt."

**[Bám đồ án]** Mục 5.1.1 + đoạn code `updateOne` in trong Chương 3 (Mục 3.1.2); Bảng 3.1 so sánh MongoDB/RDBMS; Bảng kết quả k6 (Mục 4.4): 100 VUs/20 stock và 250 VUs/50 stock, avg 5.215ms và 8.450ms, throughput 8,71 → 19,93 reqs/s; 4 kết luận phân tích (độ chính xác tồn kho, khả năng mở rộng, độ ổn định, tối ưu tài nguyên DB).

**Câu hỏi gần như chắc chắn bị hỏi:**
- *"Sao thời gian phản hồi trung bình tới 5–8 giây, chậm vậy?"* → Trả lời thẳng: đây là kịch bản **cực đoan** — toàn bộ request bắn cùng một thời điểm vào một tài liệu duy nhất trên máy cá nhân (i7-12700H, 16GB, DB localhost); mục tiêu đo là **tính đúng đắn dưới tranh chấp tối đa** (0% oversell), không phải latency vận hành thường. Điều quan trọng là không nghẽn luồng, không rớt kết nối — đã ghi trong phân tích kết quả Chương 4.
- *"Sao không dùng Redis lock/Redlock?"* → thêm một hop mạng và điểm hỏng mới; điều kiện nguyên tử tại DB là nơi dữ liệu sống, đơn giản và đủ (đã có trong QnA guide câu 4).
- *"Trừ kho xong tạo đơn fail thì sao?"* → đơn nào giữ kho đều ghi `stockReservedAt`; nếu flow gãy, sweeper theo `reservationExpiresAt` hoàn kho — chính cơ chế TTL vừa demo ở Đoạn 6.

---

### ĐOẠN 8 — Vendor Dashboard: thống kê Recharts + chat realtime (2 phút)

**[Thao tác]**
1. Sang cửa sổ vendor: mở tab Thống kê — biểu đồ doanh thu theo ngày/tháng, thẻ chỉ số, cảnh báo sắp hết hàng.
2. Chỉ vào đơn vừa đặt lúc nãy trong danh sách đơn, đổi trạng thái.
3. Từ màn buyer bấm "Chat với người bán" → gửi tin nhắn → tin hiện tức thì bên vendor → vendor trả lời → hiện lại bên buyer.

**[Script]**
> "Phía nhà bán hàng — ca sử dụng số 4 trong quyển. Dashboard tổng hợp doanh thu theo ngày, đơn theo trạng thái, doanh số theo tháng, vẽ bằng **Recharts trên SVG**, kèm **cảnh báo sản phẩm dưới ngưỡng tồn kho** — đúng luồng ngoại lệ em đặc tả ở Bảng 2.5. Doanh thu ở đây đã được **bóc tách theo từng vendor từ mảng `vendors` nhúng trong đơn hàng tổng**, sau khi trừ voucher của shop và hoa hồng sàn mặc định 10% — tức là một đơn nhiều shop được điều phối tự động mà không cần join nhiều bảng.
>
> Đơn em vừa đặt lúc nãy đã nằm ở đây, và vendor cập nhật trạng thái độc lập với các shop khác trong cùng đơn tổng.
>
> Cuối cùng là chat: em nhắn từ phía người mua — tin hiện tức thì phía người bán. Hai bên join cùng **phòng Socket.IO theo conversationId**, token được kiểm tra ngay ở bước bắt tay kết nối; tin nhắn **lưu bền vững vào MongoDB trước khi phát lại**, nên người nhận offline vẫn nhận đủ lịch sử khi mở lại hội thoại — em đặc tả luồng này ở Phụ lục B.3."

**[Bám đồ án]** UC4 (Bảng 2.5), Mục 5.3 (order routing, mảng vendors, commission 10%), Phụ lục B.3 (chat + xử lý offline/reconnect), Mục 3.2.2 (xác thực token lúc handshake).

---

### ĐOẠN 9 — Chốt demo (45 giây)

**[Script]**
> "Em xin tóm tắt: hệ thống hoàn chỉnh khoảng **28.800 dòng mã trên 196 tệp** — backend 26 service nghiệp vụ, hai ứng dụng giao diện. Về kiểm chứng: **22/22 ca kiểm thử tự động đạt** trên ba module VoucherService, InteractionService và StockReservationService; 4 kịch bản kiểm thử thủ công đầu cuối đạt; và kiểm thử tải k6 xác nhận **0,00% oversell dưới 250 request đồng thời** như hội đồng vừa thấy trực tiếp.
>
> Em cũng chủ động ghi nhận trong Chương 6 ba hạn chế: tính toán gợi ý sẽ trễ khi ma trận tương tác lên hàng triệu bản ghi — hướng xử lý là tiền tính toán offline; SSE đang in-memory một tiến trình — hướng xử lý là Redis Pub/Sub khi scale ngang; và logistics đang mô phỏng — hướng xử lý là tích hợp GHN/GHTK/Viettel Post. Em xin hết phần demo, mời hội đồng đặt câu hỏi."

**[Bám đồ án]** Bảng thống kê mã nguồn (Mục 4.3.2), tổng kết kiểm thử (Mục 4.4), Chương 6 (3 hạn chế + 3 nhánh phát triển). **Chủ động nêu hạn chế trước khi thầy hỏi** — thầy đọc kỹ nên chắc chắn biết; tự nêu sẽ ghi điểm chủ động.

---

## PHẦN 3 — BẢNG PHÂN BỔ THỜI GIAN & PHƯƠNG ÁN CO GIÃN

| Đoạn | Nội dung | Chuẩn (15') | Rút gọn (8') |
|---|---|---|---|
| 1 | Mở đầu, đặt vấn đề | 1' | 0,5' |
| 2 | Kiến trúc | 1,5' | 1' (chỉ hình, 3 câu) |
| 3 | Auth + rate-limit | 2' | 1' (bỏ demo 429, chỉ nói) |
| 4 | Search + gợi ý | 2,5' | 1' (chỉ demo không dấu + nói công thức) |
| 5 | Voucher 4 lớp | 3' | 2' |
| 6 | Đặt hàng + idempotency + TTL | 2,5' | 1,5' (COD) |
| 7 | **k6 chống oversell** | 2,5' | 2' (giữ nguyên — đây là đinh của demo) |
| 8 | Vendor + chat | 2' | bỏ hoặc 30" chỉ thông báo SSE |
| 9 | Chốt | 0,75' | 0,5' |

**Nguyên tắc co giãn:** không bao giờ cắt Đoạn 5 và 7 (hai đóng góp được viết đậm nhất trong quyển). Đoạn 4 và 8 là phần cắt đầu tiên.

---

## PHẦN 4 — XỬ LÝ SỰ CỐ TRỰC TIẾP TRÊN SÂN KHẤU

| Sự cố | Hành động | Câu nói chữa |
|---|---|---|
| Stripe webhook không về, đơn treo "chờ xác nhận" | Không đứng đợi. Chuyển màn hình sang log/ảnh chụp sẵn | "Webhook phụ thuộc tunnel ra Internet của mạng hội trường — em xin chiếu giao dịch em chạy sáng nay; cơ chế xử lý là như em vừa trình bày, và nếu webhook không bao giờ về thì chính sweeper 60 giây sẽ hoàn kho — đây là thiết kế chịu lỗi có chủ đích." |
| Voucher báo hết lượt | Dùng mã dự phòng thứ 2 đã seed | "Voucher này hết lượt sử dụng — đúng hành vi của ràng buộc usageLimit em kiểm thử ở TC11; em dùng mã khác." (biến lỗi thành demo tính năng) |
| k6 lỗi/token hết hạn | Mở `/tmp/k6_scenario1.txt` của lần chạy sáng | "Em xin trình bày trên kết quả chạy lúc sáng, số liệu khớp Bảng trong quyển." |
| Chat không nối (token 15' hết hạn) | Refresh trang buyer rồi thử lại | Không giải thích dài; nếu bị hỏi: "Socket handshake dùng access token ngắn hạn 15 phút, refresh trang sẽ lấy token mới — điểm này em đã ghi nhận để cải thiện bằng cơ chế re-auth trên socket." |
| Gợi ý trang chủ không đổi ngay | Không bấm loạn; giải thích | "Điểm tương tác ghi nhận bất đồng bộ và có cache ngắn hạn theo người dùng — em đã nêu trade-off này ở hạn chế Chương 6." |
| Mạng hội trường chết hoàn toàn | Toàn bộ stack chạy localhost — chỉ mất Stripe/VNPay/R2 ảnh ngoài | Demo COD + ảnh chụp sẵn cho thanh toán; ảnh sản phẩm có thể vỡ — nói rõ do R2 là dịch vụ cloud. |

---

## PHẦN 5 — 10 CÂU THẦY DỄ HỎI *NGAY TRONG LÚC DEMO* (trả lời 30 giây, trỏ về quyển)

> Bộ 25 câu đầy đủ + đáp án chuẩn đã có ở `docs/QnA-Defence-Guide.md`. Dưới đây là bản rút gọn phản xạ nhanh, gắn với thời điểm dễ bị hỏi nhất trong demo.

1. **(Đoạn 7)** *"Hai request cùng lúc mà MongoDB không có transaction thì sao đúng được?"* → Không cần transaction đa tài liệu: điều kiện + trừ kho nằm trong **một** lệnh ghi trên **một** tài liệu, MongoDB đảm bảo single-document atomicity + document-level locking (Mục 3.1.1).
2. **(Đoạn 7)** *"PostgreSQL cũng làm được `UPDATE ... WHERE stock >= qty` mà?"* → Đúng, em ghi nhận điều này trong quyển; lợi thế MongoDB là biến thể nằm trong mảng nhúng nên **một lệnh cập nhật cả tổng kho lẫn kho biến thể**, không cần JOIN/2 bảng (đoạn cuối Mục 3.1.2 — thầy đọc kỹ sẽ biết em có viết câu này, đừng trả lời như MongoDB là lựa chọn duy nhất).
3. **(Đoạn 6)** *"Idempotency key do client sinh, client gian lận đổi key liên tục thì sao?"* → Key chỉ chống trùng vô ý (double-click, retry mạng); đổi key = chủ đích đặt nhiều đơn, vẫn phải qua giữ kho nguyên tử nên không gây oversell; rate-limit chặn spam.
4. **(Đoạn 6)** *"15 phút giữ kho lấy từ đâu?"* → Khớp với vòng đời session thanh toán của cổng; là tham số cấu hình, trade-off giữa trải nghiệm người mua và khóa kho của shop.
5. **(Đoạn 5)** *"Đổi thứ tự shop → platform → shipping được không?"* → Không: platform voucher tính trên cơ sở đã trừ shop discount; đảo thứ tự làm cơ sở phần trăm sai, sàn/shop chịu thiệt (QnA câu 13).
6. **(Đoạn 5)** *"Ai chịu chi phí voucher platform trong doanh thu vendor?"* → Doanh thu vendor = subtotal − shop voucher (của chính shop) − commission 10%; platform/shipping voucher do sàn chịu, không khấu trừ vào vendor — nhất quán với cấu trúc `vendors[].voucherDiscount` (Mục 5.3.1).
7. **(Đoạn 4)** *"Điểm cosine similarity tính online mỗi request à? Có chậm không?"* → Giới hạn không gian: tối đa 50 ứng viên láng giềng → top-20, kèm cache ngắn hạn; hạn chế và hướng tiền tính toán offline đã nêu ở Chương 6.
8. **(Đoạn 3)** *"Access token sống bao lâu? Bị lộ thì sao?"* → Ngắn hạn (15 phút), nằm trong HttpOnly cookie; refresh token rotation + deny-list Redis thu hồi cả chuỗi khi phát hiện token cũ bị dùng lại (Mục 3.3).
9. **(Đoạn 8)** *"SSE khác gì WebSocket, sao không dùng một thứ?"* → Thông báo là đẩy một chiều — SSE chạy trên HTTP thuần, tự reconnect, nhẹ; chat cần hai chiều mới đáng dùng Socket.IO. Dùng đúng công cụ cho đúng bản chất dữ liệu (Mục 3.2.2).
10. **(Đoạn 9)** *"Đề tài nói 'hiệu năng cao' nhưng latency 8 giây?"* → Phân biệt 2 khái niệm: benchmark k6 là **stress test tính đúng đắn** tại điểm tranh chấp cực đại trên máy cá nhân; "hiệu năng cao" của đề tài thể hiện ở kiến trúc non-blocking, Redis cache, atomic write không nghẽn connection pool — throughput tăng tuyến tính khi tải tăng 2,5 lần (8,71 → 19,93 reqs/s) chứng minh điều đó.

---

## PHẦN 6 — LỜI KHUYÊN SÂN KHẤU (30 giây đọc trước khi vào phòng)

- **Luôn nói "như em đã trình bày ở Mục/Bảng/Hình X"** — với thầy đã đọc kỹ quyển, đây là tín hiệu mạnh nhất rằng demo và quyển là một khối nhất quán.
- Số liệu nói ra phải **khớp tuyệt đối với quyển**: 22/22 test, 11/11 VoucherService, 0,00% oversell, 19,93 reqs/s, τ=30 ngày, trọng số 0.4/0.3/0.2/0.1, commission 10%, TTL 15 phút, sweep 60 giây, 28.796 dòng mã. Sai một số là mất niềm tin cả buổi.
- Khi có lỗi xảy ra: **không xin lỗi rối rít, không bấm loạn** — mỗi lỗi trong bảng Phần 4 đều có một câu chữa biến nó thành minh chứng cho thiết kế chịu lỗi.
- Không nói "tuyệt đối/không bao giờ lỗi" trừ đúng một chỗ được phép mạnh miệng: oversell = 0 **trong phạm vi đã kiểm chứng** — luôn kèm cụm "trong các kịch bản kiểm thử của em".
