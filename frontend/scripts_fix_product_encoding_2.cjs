const fs = require("fs");
const path = "frontend/src/pages/main/Product.jsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace('{/* Vendor / Shop card */}}', '{/* Vendor / Shop card */}');
content = content.replace('return { ok: false, message: `Vui lÃ²ng chá»n ${productData.attributes.map(a => a.name).join(\', \')}` };', 'return { ok: false, message: `Vui lòng chọn ${productData.attributes.map(a => a.name).join(\', \')}` };');
content = content.replaceAll('{vendorStats?.productCount ?? "â€”"}', '{vendorStats?.productCount ?? "—"}');
content = content.replaceAll('{vendorStats?.sold ?? "â€”"}', '{vendorStats?.sold ?? "—"}');
content = content.replaceAll('>â€”<', '>—<');
content = content.replaceAll('{vendorFollowerCount !== null ? vendorFollowerCount : "â€”"}', '{vendorFollowerCount !== null ? vendorFollowerCount : "—"}');

fs.writeFileSync(path, content, "utf8");
