# PlantUML cho Chương 2

Thư mục này chứa source PlantUML cho các biểu đồ trong `Chương 2`.

Các file:

- `general_use_case.puml`
- `auth_security_use_case.puml`
- `ordering_payment_use_case.puml`
- `merchant_console_use_case.puml`
- `checkout_process_activity.puml`
- `order_creation_sequence.puml`
- `online_payment_confirmation_sequence.puml`

Môi trường hiện tại:

- Java đã được cài tại `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\bin\java.exe`
- PlantUML jar đã được tải tại `C:\tmp\plantuml.jar`

Render nhanh toàn bộ biểu đồ:

```powershell
powershell -ExecutionPolicy Bypass -File report/Chuong/plantuml/render-diagrams.ps1
```

Render một file cụ thể:

```powershell
powershell -ExecutionPolicy Bypass -File report/Chuong/plantuml/render-diagrams.ps1 -InputFile report/Chuong/plantuml/auth_security_use_case.puml
```

Ảnh PNG sẽ được xuất vào:

```text
report/Chuong/images/generated
```
