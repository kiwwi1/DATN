# HƯỚNG DẪN & QUY TẮC VIẾT ĐỒ ÁN TỐT NGHIỆP CHUẨN KHOA HỌC

Tài liệu này tổng hợp toàn bộ các quy định, hướng dẫn định dạng và quy tắc hành văn khoa học bắt buộc áp dụng khi viết báo cáo Đồ án tốt nghiệp (ĐATN) theo chuẩn báo cáo kỹ thuật kỹ sư/cử nhân (ISO 7144:1986).

---

## 1. QUY ĐỊNH CHUNG VỀ ĐỊNH DẠNG & TRÌNH BÀY

> [!IMPORTANT]
> Sinh viên cần đảm bảo tính thống nhất trên toàn bộ báo cáo từ phông chữ, khoảng cách dòng, căn lề lề hai bên, chú thích hình ảnh, bảng biểu đến định dạng margin trang.

### 📐 Cấu hình lề trang & In hai mặt (Margin & Twoside)
Trong file chính [DoAn.tex](file:///d:/Code/DATN/report/DoAn.tex), cấu hình chuẩn được thiết lập như sau:
*   **Kích thước chữ (Font Size)**: `13pt` chuẩn Times New Roman.
*   **Khoảng cách dòng (Line Spacing)**: `1.5 line` (`\onehalfspacing`).
*   **Khoảng cách đoạn (Paragraph Spacing)**: `6pt` (`\parskip{6pt}`).
*   **Thụt đầu dòng (Indentation)**: `15pt` (`\parindent{15pt}`).
*   **Cơ chế Lề trang hai mặt (`twoside`)**:
    *   **Lề trên / dưới**: $2.0$ cm.
    *   **Lề trong (Inner - left)**: $3.5$ cm (Dành cho gáy đóng quyển, bảo đảm chữ không bị đè).
    *   **Lề ngoài (Outer - right)**: $2.5$ cm.

### 📊 Bảng biểu, Hình vẽ & Công thức
*   **Nguyên tắc vàng**: Tất cả hình vẽ, bảng biểu, công thức, và tài liệu tham khảo trong ĐATN **nhất thiết phải được giải thích và tham chiếu chéo ít nhất một lần** trong nội dung văn bản (ví dụ: *``... như mô tả trong Hình \ref{fig:general_use_case}''*).
*   **Cấm kỵ**: Tuyệt đối không đưa hình vẽ hoặc bảng biểu vào báo cáo một cách tùy hứng mà không có lời dẫn dắt hoặc giải thích cụ thể bên dưới.

### 🔗 Tránh đạo văn
*   Tất cả các kiến thức, câu trích dẫn, sơ đồ hoặc số liệu không phải do sinh viên tự nghiên cứu/vẽ ra **bắt buộc phải được ghi rõ nguồn** bằng tham chiếu thư mục `\cite{...}` và đăng ký đầy đủ tại tệp dữ liệu tài liệu tham khảo [Danh_sach_tai_lieu_tham_khao.bib](file:///d:/Code/DATN/report/Danh_sach_tai_lieu_tham_khao.bib).

---

## 2. QUY TẮC HÀNH VĂN & VĂN PHONG KHOA HỌC (ACADEMIC TONE)

> [!WARNING]
> Báo cáo ĐATN là một tài liệu khoa học kỹ thuật nghiêm túc, không phải slide thuyết trình hay bài viết chia sẻ quan điểm cá nhân. Sinh viên cần đặc biệt lưu ý cách hành văn.

### ✍️ Cấu trúc đoạn văn
*   **Tính đơn ý**: Mỗi đoạn văn không được quá dài. Mỗi đoạn cần có ý tứ rõ ràng, bao gồm **duy nhất một ý chính** ở câu chủ đề và các câu phân tích bổ trợ để làm rõ hơn ý chính đó.
*   **Đầy đủ ngữ pháp**: Các câu văn trong đoạn phải đầy đủ chủ ngữ, vị ngữ.
*   **Tính liên kết**: Câu sau phải liên kết chặt chẽ với câu trước, đoạn sau liên kết logic với đoạn trước.
*   **Độ cô đọng**: Các câu văn cần được tối ưu hóa từ ngữ, bảo đảm rất khó để thêm hoặc bớt đi được dù chỉ một từ mà vẫn giữ nguyên ý nghĩa.

### 🚫 Các từ ngữ bị cấm tuyệt đối (Văn phong cảm xúc)
Tuyệt đối không sử dụng từ ngữ thuộc văn nói, các từ phóng đại, thái quá, hoặc các từ thiếu tính khách quan:

| ❌ Từ ngữ bị cấm (Văn nói / Cảm xúc) | ✔️ Giải pháp thay thế (Khách quan / Khoa học) |
|---|---|
| *Tuyệt vời*, *rất đỉnh*, *cực hay* | Đạt hiệu quả cao, tối ưu hóa tốt, vượt trội |
| *Cực kỳ hữu ích*, *siêu nhanh* | Đáp ứng tốt yêu cầu xử lý, cải thiện tốc độ phản hồi |
| *Theo tôi nghĩ*, *tôi thấy rằng* | Dựa trên kết quả thực nghiệm, dữ liệu cho thấy |
| *Hoàn hảo không vết xước*, *100% không lỗi* | Đạt độ tin cậy cao, triệt tiêu tối đa rủi ro phát sinh |

---

## 3. CẤU TRÚC BẮT BUỘC CỦA MỖI CHƯƠNG (TỔNG QUAN & KẾT CHƯƠNG)

Mỗi chương trong báo cáo bắt buộc phải tuân thủ cấu trúc đóng - mở mạch lạc bằng hai phần: **Tổng quan** và **Kết chương** với định dạng văn bản bình thường (Normal), không in đậm/in nghiêng, không đóng khung.

```mermaid
graph TD
    A[Bắt đầu Chương N] --> B["Phần Tổng quan (Introduction)"]
    B --> C["Liên kết với Chương N-1"]
    B --> D["Trình bày sự cần thiết của Chương N"]
    B --> E["Giới thiệu các mục lớn sẽ trình bày"]
    E --> F[Nội dung chi tiết của Chương N]
    F --> G["Phần Kết chương (Conclusion)"]
    G --> H["Tóm tắt nội dung và cách giải quyết"]
    G --> I["Đưa ra các kết luận quan trọng nhất"]
    G --> J["Câu chuyển tiếp/liên kết tới Chương N+1"]
    J --> K[Kết thúc Chương N]
```

### 🔹 Phần Tổng quan (Đầu chương)
*   **Mục tiêu**: Tạo sự liên kết logic với chương đứng trước.
*   **Nội dung**:
    1.  Liên kết ngắn gọn với Chương $N-1$.
    2.  Trình bày lý do xuất hiện và sự cần thiết của Chương $N$ trong tổng thể đồ án.
    3.  Giới thiệu khái quát các vấn đề sẽ trình bày trong chương kèm theo các số hiệu mục lớn tương ứng.

### 🔸 Phần Kết chương (Cuối chương)
*   **Mục tiêu**: Đóng lại các vấn đề đã mở ra ở phần Tổng quan.
*   **Nội dung**:
    1.  Đưa ra một số kết luận kỹ thuật/khoa học quan trọng nhất của chương.
    2.  Tóm tắt lại kết quả đạt được và cách giải quyết các bài toán trong chương.
    3.  **Bắt buộc**: Có một câu chuyển tiếp liên kết chặt chẽ tới chương tiếp theo (Chương $N+1$).
    4.  *Chú ý*: Không viết nội dung phần Kết chương trùng lặp hoàn toàn với phần Tổng quan.

---

## 4. HƯỚNG DẪN TRÌNH BÀY CHI TIẾT CHƯƠNG 1 (GIỚI THIỆU)

Chương 1 có độ dài tiêu chuẩn từ **3 đến 6 trang** và cấu trúc bắt buộc như sau:

### 📥 1. Đặt vấn đề
*   **Nội dung**: Làm nổi bật mức độ cấp thiết, tầm quan trọng hoặc quy mô của bài toán thực tế cần giải quyết.
*   **Gợi ý cấu trúc**: Xuất phát từ tình hình thực tế $\rightarrow$ dẫn đến vấn đề hoặc bài toán phát sinh $\rightarrow$ lợi ích mang lại cho xã hội/doanh nghiệp khi vấn đề được giải quyết.
*   **Quy định nghiêm ngặt**: Chỉ trình bày vấn đề thực tế, **tuyệt đối không trình bày giải pháp kỹ thuật** ở phần này.

### 📥 2. Mục tiêu và phạm vi đề tài
*   **Nội dung**:
    1.  Trình bày tổng quan kết quả nghiên cứu hiện có hoặc các sản phẩm thương mại hiện có trên thị trường.
    2.  Tiến hành so sánh, đánh giá tổng quan ưu/nhược điểm của các giải pháp hiện tại.
    3.  Khái quát lại các hạn chế đang gặp phải $\rightarrow$ xác định nhiệm vụ cụ thể đồ án hướng tới giải quyết để khắc phục hạn chế đó.
*   **Quy định nghiêm ngặt**: Chỉ trình bày tổng quan mức cao, **không đi sâu vào chi tiết** giải pháp kỹ thuật.

### 📥 3. Định hướng giải pháp
*   **Nội dung**: Trình bày định hướng giải quyết theo trình tự:
    1.  Giải quyết bằng định hướng/công nghệ/thuật toán/kỹ thuật cụ thể nào.
    2.  Mô tả cực kỳ ngắn gọn giải pháp tổng quan của đồ án khi đi theo định hướng đó.
    3.  Nêu rõ đóng góp chính của đồ án và kết quả kỳ vọng đạt được.
*   **Quy định**: Không phân tích hay giải thích chi tiết thuật toán/công nghệ ở đây (phần chi tiết dành cho Chương 3 và Chương 4). Chỉ mô tả ngắn gọn từ 1 đến 2 câu và giải thích nhanh lý do lựa chọn.

### 📥 4. Bố cục đồ án
*   **Quy định nghiêm ngặt**: Viết hoàn toàn dưới dạng **các đoạn văn đầy đủ**, mô tả logic và liên kết. **Tuyệt đối cấm gạch ý hoặc dùng bullet đầu dòng** trong phần này.
*   *Lưu ý*: Chỉ mô tả từ Chương 2 trở đi, không cần tự mô tả lại Chương 1.

---

## 5. QUY TẮC LIỆT KÊ & SỬ DỤNG BULLET TRONG BÁO CÁO

*   **Hạn chế lạm dụng gạch đầu dòng**: Việc sử dụng quá nhiều gạch đầu dòng làm giảm tính liên kết của bài viết khoa học. Khi cần liệt kê, ưu tiên sử dụng phong cách viết La Mã lồng ghép trực tiếp vào câu văn dạng:
    > *``nhiều sinh viên luôn cảm thấy hối hận vì (i) chưa cố gắng hết mình, (ii) chưa sắp xếp thời gian học/chơi hợp lý...''*
*   **Thống nhất Style cho Bullet**: Trong trường hợp bắt buộc phải sử dụng các gạch đầu dòng liệt kê, sinh viên phải bảo đảm **thống nhất tuyệt đối** style bullet trên toàn báo cáo:
    *   Nếu bullet cấp 1 sử dụng hình tròn đen (`\bullet`), toàn bộ báo cáo từ Chương 1 đến Phụ lục đều phải sử dụng hình tròn đen cho cấp 1.
    *   Nên sử dụng môi trường `itemize` chuẩn của $\text{\LaTeX}$ để tự động hóa căn lề thụt dòng đều đặn, không tự ý gõ dấu gạch ngang `-` hoặc dấu sao `*` thô ở đầu dòng văn bản.

---

## 6. BẢN ĐỒ TỔNG QUAN CÁC CHƯƠNG & MỤC ĐÍCH CỦA QUYỂN ĐỒ ÁN

Bảng phân tích dưới đây khái quát hóa mục tiêu kỹ thuật, vai trò học thuật và liên kết logic của từng chương trong toàn bộ quyển ĐATN giúp sinh viên nắm vững lộ trình triển khai:

```mermaid
graph TD
    C1[Chương 1: Giới thiệu đề tài] -->|Đặt bài toán| C2[Chương 2: Phân tích thiết kế hệ thống]
    C2 -->|Đặc tả chức năng & Tải cao| C3[Chương 3: Nền tảng công nghệ sử dụng]
    C3 -->|Kiến trúc & Thuật toán| C4[Chương 4: Thiết kế chi tiết & Triển khai]
    C4 -->|Rút ra 2-3 lõi tinh túy nhất| C5[Chương 5: Đóng góp & Giải pháp nổi bật]
    C5 -->|Đối chiếu so sánh thực tiễn| C6[Chương 6: Kết luận & Hướng phát triển]
    C7[Chương 7: Lưu ý tài liệu tham khảo] -.->|Chuẩn hóa trích dẫn chéo| C3 & C5
    PLB[Phụ lục B: Đặc tả Use Case phụ] -.->|Giảm tải dung lượng| C2
```

### 📑 Chi tiết mục đích và nhiệm vụ của từng chương

#### 1. Chương 1: Giới thiệu đề tài (Mở đầu)
*   **Mục đích**: Thiết lập bối cảnh thực tiễn và tính cấp thiết khoa học của đề tài. Nhấn mạnh vào ba thách thức cốt lõi: tranh chấp kho tải cao (Overselling), bảo mật xác thực (Refresh Token Rotation), và cá nhân hóa trải nghiệm khách hàng.
*   **Nhiệm vụ cốt lõi**: Đặt vấn đề thực tế (không đưa giải pháp), nêu rõ mục tiêu và phạm vi giới hạn của đề tài, phác thảo định hướng công nghệ tổng quan và bố cục mạch lạc của báo cáo.

#### 2. Chương 2: Phân tích và Thiết kế hệ thống (Ranh giới chức năng)
*   **Mục đích**: Đặc tả chi tiết các tác nhân (Khách hàng, Vendor, Platform Admin) cùng các biểu đồ ca sử dụng (Use Case) để phân rã chức năng.
*   **Nhiệm vụ cốt lõi**: Khảo sát hiện trạng (so sánh với Shopify, Woocommerce); xây dựng quy trình nghiệp vụ mua bán giữ kho kết hợp thanh toán đồng thời (Activity Diagram & Sequence Diagram); đặc tả chi tiết 4 Use Case cốt lõi (Auth, Place Order, Apply Vouchers, Merchant Stats); thiết lập yêu cầu phi chức năng (tốc độ API < 200ms, độ lệch tồn kho 0%, rate-limit).

#### 3. Chương 3: Nền tảng lý thuyết và Công nghệ sử dụng (Cơ sở khoa học)
*   **Mục đích**: Giải thích, phân tích và chứng minh lý do lựa chọn bộ công nghệ (MERN Stack, Redis cache, Socket.IO, Stripe/VNPay, Hybrid Recommendation Engine) để giải quyết các yêu cầu đặt ra ở Chương 2.
*   **Nhiệm vụ cốt lõi**: Với mỗi công nghệ/lý thuyết được trình bày, sinh viên phải so sánh đối chiếu chi tiết với **giải pháp thay thế tương đương** và chứng minh sự vượt trội của lựa chọn hiện tại dựa trên các chỉ số khoa học thực tế.

#### 4. Chương 4: Phân tích thiết kế, Triển khai và Đánh giá hệ thống (Thiết kế chi tiết)
*   **Mục đích**: Hiện thực hóa kiến trúc phần mềm từ mức khái niệm sang mức thiết kế cấu trúc chi tiết và vật lý của hệ thống.
*   **Nhiệm vụ cốt lõi**: Vẽ biểu đồ thiết kế gói UML (UML Package Diagram) phân lớp rõ ràng; thiết kế sơ đồ lớp chi tiết và luồng truyền thông điệp; thiết kế sơ đồ thực thể liên kết (E-R Diagram) / lược đồ MongoDB tài liệu lồng nhau; liệt kê thư viện, công cụ lập trình kèm phiên bản cụ thể; thiết kế kịch bản kiểm thử (Test Cases) và triển khai server/thiết bị thực tế.

#### 5. Chương 5: Các giải pháp và đóng góp nổi bật (Trọng tâm học thuật)
*   **Mục đích**: Là nơi sinh viên thể hiện sự tâm đắc, sáng tạo và lập luận khoa học để giải quyết các bài toán khó nhất của đồ án. Đây là cơ sở then chốt để thầy cô đánh giá điểm số.
*   **Nhiệm vụ cốt lõi**: Trình bày độc lập từ 2 đến 3 đóng góp lớn nhất (ví dụ: *Thuật toán giữ kho nguyên tử ngăn chặn oversell dưới tải cao*, *Động cơ tính giảm giá bảo mật 4 lớp*, hoặc *Lớp đệm bảo mật rate-limit bằng Redis*). Mỗi đóng góp phải viết đủ 3 phần con: (i) dẫn dắt bài toán khó, (ii) giải pháp chi tiết của bản thân, và (iii) kết quả thực nghiệm đạt được.

#### 6. Chương 6: Kết luận và Hướng phát triển (Tổng kết và Mở rộng)
*   **Mục đích**: Tổng kết và đánh giá công bằng kết quả đạt được sau toàn bộ quá trình nghiên cứu, thực hiện đồ án.
*   **Nhiệm vụ cốt lõi**: So sánh sản phẩm/kết quả thực tế của mình với các sản phẩm tương tự trên thị trường; phân tích rõ những gì đã làm được và những gì còn hạn chế; đúc kết bài học kinh nghiệm; đề ra định hướng công việc và hướng đi mới trong tương lai để nâng cấp/cải thiện sản phẩm.

#### 7. Chương 7: Một số lưu ý về tài liệu tham khảo (Quy chuẩn trích dẫn)
*   **Mục đích**: Hướng dẫn và chuẩn hóa cách thức liệt kê thông tin tài liệu tham khảo.
*   **Nhiệm vụ cốt lõi**: Phân loại và khai báo chuẩn hóa 5 nguồn tài liệu chính (Bài báo tạp chí khoa học, Sách, Tập san báo cáo hội nghị, Đồ án/luận văn tốt nghiệp, Tài liệu Internet chính thống). **Tuyệt đối cấm** đưa bài giảng/slide, Wikipedia hoặc các blog cá nhân trôi nổi làm tài liệu tham khảo.

#### 8. Các Phụ lục (Supplementary Information)
*   **Phụ lục A (Hướng dẫn viết ĐATN)**: Chứa các quy định chi tiết về cách định dạng tài liệu, cài đặt công cụ.
*   **Phụ lục B (Đặc tả Use Case bổ sung)**: Chứa thông tin đặc tả chi tiết của các Use Case phụ nhằm giảm dung lượng, giúp nội dung Chương 2 tập trung sâu sắc vào các Use Case cốt lõi nhạy cảm của hệ thống.


---

## 7. NỘI DUNG THAM CHIẾU THEO BỘ CHƯƠNG HIỆN TẠI CỦA ĐỒ ÁN

Phần này tổng hợp trực tiếp nội dung đang có trong các tệp chương hiện tại để dùng như một khung viết thống nhất khi chỉnh sửa báo cáo. Mục tiêu của mục này không phải thay thế nội dung trong các tệp chương gốc, mà giúp sinh viên biết mỗi chương hiện đang viết gì, nên giữ trọng tâm nào, và khi mở rộng thì cần bám theo mạch logic nào.

### 7.1. Chương 1 -- Giới thiệu đề tài

**Tệp nguồn tham chiếu:** report/Chuong/1_Gioi_thieu.tex

**Vai trò của chương:**
Chương 1 dùng để đặt bối cảnh thực tiễn cho đề tài, xác định bài toán trung tâm và chốt phạm vi nghiên cứu trước khi bước sang các chương phân tích, công nghệ và triển khai.

**Nội dung hiện tại của chương gồm 4 phần chính:**
1. Đặt vấn đề: trình bày sự phát triển của thương mại điện tử đa nhà bán hàng, các thách thức như overselling dưới tải cao, rủi ro bảo mật xác thực, và nhu cầu cá nhân hóa trải nghiệm người dùng.
2. Mục tiêu và phạm vi đề tài: khảo sát các nền tảng như Shopify, WooCommerce và các sàn lớn tại Việt Nam; từ đó chỉ ra ba hạn chế chính và xác định 5 nhóm chức năng cốt lõi của đề tài.
3. Định hướng giải pháp: nêu định hướng dùng MERN Stack, Redis, Socket.IO, Stripe, VNPay và bộ gợi ý sản phẩm lai có suy hao theo thời gian.
4. Bố cục đồ án: mô tả logic nội dung từ Chương 2 đến Chương 6.

**Khi viết hoặc chỉnh chương này, cần giữ đúng trọng tâm:**
- Chỉ nêu bài toán, động lực nghiên cứu và mục tiêu.
- Không đi sâu vào chi tiết thuật toán, schema dữ liệu hay triển khai mã nguồn.
- Phần bố cục nên viết bằng đoạn văn liên kết, không dùng bullet liệt kê thô trong bản báo cáo chính thức.

### 7.2. Chương 2 -- Khảo sát, phân tích yêu cầu và đặc tả chức năng

**Tệp nguồn tham chiếu:** report/Chuong/2_Khao_sat.tex

**Vai trò của chương:**
Chương 2 xác định ranh giới hệ thống, tác nhân, luồng nghiệp vụ và yêu cầu chức năng/phi chức năng. Đây là chương chuyển từ “bài toán thực tế” sang “bài toán hệ thống phần mềm”.

**Nội dung hiện tại của chương gồm 4 cụm lớn:**
1. Khảo sát hiện trạng: tổng hợp nhu cầu từ người mua, nhà bán hàng và hạn chế của các hệ thống thương mại điện tử phổ biến.
2. Tổng quan chức năng: mô tả các tác nhân Buyer, Vendor và khối vận hành; đi kèm các biểu đồ use case tổng quát và phân rã theo phân hệ.
3. Quy trình nghiệp vụ đặt hàng giữ kho và thanh toán đồng thời: mô tả luồng checkout, giữ kho, tạo đơn, thanh toán online, hoàn kho quá hạn; có activity diagram và nhiều sequence diagram tách theo giai đoạn.
4. Đặc tả chức năng và yêu cầu phi chức năng: đặc tả chi tiết 4 use case cốt lõi gồm đăng nhập, đặt hàng, áp dụng voucher và xem thống kê; sau đó chốt các yêu cầu hiệu năng, nhất quán dữ liệu, dễ dùng và bảo mật.

**Các phân hệ use case đang được thể hiện rõ trong chương:**
- Quản lý tài khoản và bảo mật.
- Mua hàng và thanh toán.
- Quản lý gian hàng.
- Vận hành dữ liệu và cấu hình nền tảng.

**Khi mở rộng chương này, nên bám đúng mạch:**
- Từ khảo sát thực tế đến chức năng cần có.
- Từ chức năng tổng quát đến quy trình nghiệp vụ chi tiết.
- Từ quy trình đến đặc tả use case.
- Từ use case đến yêu cầu phi chức năng đo được.

### 7.3. Chương 3 -- Cơ sở lý thuyết và công nghệ sử dụng

**Tệp nguồn tham chiếu:** report/Chuong/3_Cong_nghe.tex

**Vai trò của chương:**
Chương 3 giải thích vì sao hệ thống chọn bộ công nghệ hiện tại thay vì các phương án thay thế. Đây là nơi trả lời câu hỏi “vì sao giải pháp này phù hợp với bài toán đã đặc tả ở Chương 2”.

**Nội dung hiện tại của chương đang xoay quanh 5 nhóm công nghệ/chủ đề:**
1. MongoDB và cơ chế giữ kho nguyên tử: phân tích vấn đề nhất quán dữ liệu, tranh chấp tài nguyên tải cao, và lý do chọn MongoDB + Mongoose cho mô hình tài liệu nhiều biến thể sản phẩm.
2. Node.js, Express và Socket.IO: giải thích vì sao backend bất đồng bộ phù hợp với hệ thống I/O-intensive và giao tiếp thời gian thực.
3. Redis: dùng cho rate limiting và quản lý phiên xác thực phía server.
4. Hệ thống gợi ý sản phẩm lai: kết hợp content-based filtering, collaborative filtering và time decay để xử lý cá nhân hóa và cold start.
5. Stripe, VNPay, React và Recharts: phục vụ thanh toán trực tuyến, giao diện SPA và dashboard thống kê của vendor.

**Đặc điểm quan trọng của chương hiện tại:**
- Mỗi công nghệ đều gắn với một yêu cầu cụ thể đã nêu ở Chương 2.
- Có so sánh với giải pháp thay thế tương đương như RDBMS, Spring Boot, Django, Memcached, Long Polling, SSE.
- Trọng tâm không chỉ là “giới thiệu công nghệ”, mà là “chứng minh lý do lựa chọn công nghệ”.

**Khi viết/chỉnh chương này, cần tránh:**
- Viết như tài liệu học công nghệ chung chung.
- Liệt kê tính năng của framework mà không liên hệ đến yêu cầu hệ thống.
- Thiếu phần đối chiếu với phương án thay thế.

### 7.4. Chương 4 -- Thiết kế chi tiết, xây dựng, kiểm thử và triển khai

**Tệp nguồn tham chiếu:** report/Chuong/4_Ket_qua_thuc_nghiem.tex

**Vai trò của chương:**
Chương 4 là chương hiện thực hóa trực tiếp. Nếu Chương 2 trả lời “hệ thống cần làm gì” và Chương 3 trả lời “vì sao chọn công nghệ này”, thì Chương 4 trả lời “hệ thống đã được thiết kế và xây dựng ra sao”.

**Cấu trúc nội dung hiện tại của chương gồm 5 phần:**
1. Thiết kế kiến trúc: nêu lựa chọn kiến trúc nhiều tầng, giải thích cấu trúc backend theo routes/controllers/services/models, frontend theo pages/components/context/hooks/utils, và lý do chưa tách microservices.
2. Thiết kế chi tiết: gồm thiết kế giao diện, sơ đồ điều hướng UI, thiết kế lớp nghiệp vụ, biểu đồ tuần tự và thiết kế cơ sở dữ liệu cùng các bảng mô tả collection.
3. Xây dựng ứng dụng: liệt kê công cụ, thư viện, phiên bản, quy mô mã nguồn, các số liệu build và các ảnh minh họa chức năng chính.
4. Kiểm thử: trình bày kiểm thử đơn vị cho VoucherService và các kịch bản kiểm thử thủ công cho luồng đặt hàng, giữ kho và thanh toán.
5. Triển khai: mô tả mô hình chạy local, Docker, Nginx, MongoDB Atlas, Redis fallback, Stripe webhook và callback VNPay.

**Những điểm cần giữ nhất quán khi bổ sung nội dung chương 4:**
- Mỗi hình, bảng, biểu đồ đều phải có lời dẫn và tham chiếu chéo trong nội dung.
- Ảnh giao diện phải khớp với mô tả nghiệp vụ ngay phía trên hoặc phía dưới.
- Phần kiểm thử nên ưu tiên ca kiểm thử phản ánh trực tiếp các bài toán khó của đề tài như trùng đơn, oversell, thanh toán quá hạn, voucher sai phạm vi.
- Phần triển khai cần nêu được cả môi trường phát triển và môi trường production/container hóa.

### 7.5. Chương 5 -- Các giải pháp và đóng góp nổi bật

**Tệp nguồn tham chiếu:** report/Chuong/5_Giai_phap_dong_gop.tex

**Vai trò của chương:**
Đây là chương học thuật trọng tâm nhất, nơi thể hiện dấu ấn kỹ thuật và đóng góp riêng của đồ án. Nội dung không nên lặp lại toàn bộ Chương 3 hoặc Chương 4, mà cần chọn ra các lõi kỹ thuật quan trọng nhất để phân tích sâu.

**Hiện tại chương 5 đang tổ chức thành 3 đóng góp chính:**
1. Cơ chế giữ kho nguyên tử và chống trùng lặp giao dịch: giải quyết oversell và duplicate order bằng atomic stock reservation kết hợp idempotency key.
2. Hệ thống khuyến nghị sản phẩm lai tích hợp suy hao thời gian: xử lý cá nhân hóa, data sparsity và cold start bằng interaction scoring + time decay + hybrid recommendation.
3. Kiến trúc thanh toán và xử lý voucher đa nhà bán hàng: giải quyết bài toán order routing và hierarchical voucher engine ở backend.

**Mỗi đóng góp trong chương hiện tại đều đang đi theo cùng một khung viết:**
- Đặt vấn đề: nêu bài toán khó và rủi ro nếu không xử lý.
- Giải pháp kỹ thuật đề xuất: trình bày thiết kế, công thức, cấu trúc dữ liệu hoặc luồng xử lý.
- Kết quả đạt được: chỉ ra hiệu quả vận hành, tính đúng đắn hoặc lợi ích kỹ thuật.

**Đây là khung nên giữ nguyên khi thêm một đóng góp mới:**
- Không viết kiểu mô tả sản phẩm chung chung.
- Không gộp nhiều ý lớn vào cùng một mục.
- Mỗi giải pháp nên có bài toán riêng, cơ chế riêng và kết quả riêng.

### 7.6. Chương 6 -- Kết luận và hướng phát triển

**Tệp nguồn tham chiếu:** report/Chuong/6_Ket_luan.tex

**Vai trò của chương:**
Chương 6 dùng để tổng kết công bằng toàn bộ quá trình nghiên cứu và triển khai, chỉ ra các giá trị thật sự của đồ án, đồng thời thừa nhận các hạn chế và mở ra hướng nâng cấp tiếp theo.

**Nội dung hiện tại của chương gồm 3 phần ý chính:**
1. Các kết quả đạt được: tổng hợp thành quả về nền tảng thương mại điện tử đồng bộ, giữ kho nguyên tử, gợi ý cá nhân hóa, điều phối đơn đa nhà bán hàng và tương tác thời gian thực.
2. Hạn chế còn tồn tại: nêu hạn chế về hiệu năng bộ gợi ý thời gian thực, tính chịu lỗi của kênh SSE khi mở rộng ngang và phần logistics mới chỉ ở mức mô phỏng.
3. Hướng phát triển: đề xuất tiền tính toán gợi ý + Redis cache, message queue, Redis Pub/Sub, nâng cấp mô hình học máy và tích hợp đơn vị vận chuyển thực tế.

**Khi viết hoặc cập nhật chương kết luận, nên tuân thủ nguyên tắc:**
- Đánh giá đúng cái đã làm được, không phóng đại.
- Hạn chế phải là hạn chế kỹ thuật thực sự, không viết cho có.
- Hướng phát triển cần xuất phát trực tiếp từ các hạn chế vừa nêu.

### 7.7. Gợi ý liên kết logic giữa các chương hiện tại

Để bảo đảm báo cáo có mạch xuyên suốt, có thể kiểm tra nhanh theo chuỗi sau:
- Chương 1 đặt bài toán, mục tiêu và phạm vi.
- Chương 2 đặc tả hệ thống phải làm gì để giải quyết bài toán đó.
- Chương 3 chứng minh vì sao chọn bộ công nghệ hiện tại để thực hiện yêu cầu.
- Chương 4 mô tả hệ thống đã được thiết kế, xây dựng, kiểm thử và triển khai như thế nào.
- Chương 5 trích ra các đóng góp kỹ thuật nổi bật nhất để phân tích sâu.
- Chương 6 tổng kết giá trị đạt được, hạn chế và định hướng phát triển.

Nếu một đoạn nội dung mới không gắn được vào chuỗi logic trên, nhiều khả năng đoạn đó đang đặt sai chương hoặc viết chưa đúng vai trò học thuật của chương tương ứng.


