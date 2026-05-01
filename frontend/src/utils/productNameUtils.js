const EXACT_NAME_MAP = {
  "iPhone 15 128GB": "Điện thoại iPhone 15 128GB",
  "Samsung Galaxy A55 5G 128GB": "Điện thoại Samsung Galaxy A55 5G 128GB",
  "Xiaomi Redmi Note 13 Pro 256GB": "Điện thoại Xiaomi Redmi Note 13 Pro 256GB",
  "OPPO Reno11 F 5G 256GB": "Điện thoại OPPO Reno11 F 5G 256GB",
  "vivo V30e 5G 256GB": "Điện thoại vivo V30e 5G 256GB",
  "MacBook Air M2 13 inch 256GB": "Laptop MacBook Air M2 13 inch 256GB",
  "Dell Inspiron 15 3530 i5": "Laptop Dell Inspiron 15 3530 i5",
  "ASUS Vivobook 15 OLED A1505": "Laptop ASUS Vivobook 15 OLED A1505",
  "Lenovo IdeaPad Slim 5 14 inch": "Laptop Lenovo IdeaPad Slim 5 14 inch",
  "HP Pavilion 14 i5": "Laptop HP Pavilion 14 i5",
  "AirPods Pro 2 USB-C": "Tai nghe AirPods Pro 2 USB-C",
  "Sony WH-CH720N": "Tai nghe Sony WH-CH720N",
  "JBL Tune 770NC": "Tai nghe JBL Tune 770NC",
  "Anker Soundcore R50i": "Tai nghe Anker Soundcore R50i",
  "Samsung Galaxy Buds FE": "Tai nghe Samsung Galaxy Buds FE",
};

export const localizeProductName = (name) => {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return "";
  return EXACT_NAME_MAP[raw] || raw;
};
