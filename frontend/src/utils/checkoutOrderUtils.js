import { isDefaultCartOptionKey } from "../constants/cartOption";

const parseAttributeString = (attrStr) => {
  if (!attrStr || isDefaultCartOptionKey(attrStr)) return {};
  const result = {};
  String(attrStr)
    .split(", ")
    .forEach((part) => {
      const colonIdx = part.indexOf(": ");
      if (colonIdx !== -1) {
        result[part.substring(0, colonIdx).trim()] = part.substring(colonIdx + 2).trim();
      }
    });
  return result;
};

const getItemCombination = (item) => {
  if (Array.isArray(item?.selectedAttributes) && item.selectedAttributes.length > 0) {
    const combination = {};
    for (const attr of item.selectedAttributes) {
      if (!attr?.name || attr?.value === undefined || attr?.value === null) continue;
      combination[String(attr.name).trim()] = String(attr.value).trim();
    }
    return combination;
  }
  if (item?.size) return parseAttributeString(item.size);
  return {};
};

// Mirror của buildVariantKey phía backend (orderItemsService) — dùng để map lỗi
// OUT_OF_STOCK (trả theo cặp productId + variantKey) ngược về dòng hàng trên UI.
export const buildOrderItemVariantKey = (item) => {
  const entries = Object.entries(getItemCombination(item))
    .map(([name, value]) => [String(name || "").trim(), String(value || "").trim()])
    .filter(([name, value]) => name && value)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "";
  return entries.map(([name, value]) => `${name}:${value}`).join("|");
};

export const splitName = (fullName) => {
  const normalized = String(fullName || "").trim();
  if (!normalized) return { firstName: "", lastName: "" };
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
};

const buildOrderItemBase = (productData, quantity) => ({
  _id: productData._id,
  name: productData.name,
  price: productData.price,
  originalPrice: productData.originalPrice || productData.price,
  discount: productData.discount || 0,
  quantity,
  image: productData.image || [],
  brand: productData.brand || "",
  vendorId: productData.vendorId,
  vendorShopName: productData.vendorShopName || "",
});

const applyOptionToOrderItem = (orderItem, optionKey) => {
  const safeOptionKey = String(optionKey || "");
  if (isDefaultCartOptionKey(safeOptionKey)) {
    orderItem.size = safeOptionKey;
    orderItem.selectedAttributes = [];
    return;
  }

  if (safeOptionKey.includes(":")) {
    const attributes = safeOptionKey.split(",").map((attribute) => {
      const [name, value] = attribute.split(":").map((part) => part.trim());
      return { name, value };
    });
    orderItem.selectedAttributes = attributes;
    orderItem.size = safeOptionKey;
    return;
  }

  orderItem.size = safeOptionKey;
  orderItem.selectedAttributes = [{ name: "Size", value: safeOptionKey }];
};

export const buildOrderItemsFromSelection = (selectedCartItems, products) => {
  const orderItems = [];

  for (const selectedItem of selectedCartItems) {
    const productData = products.find((product) => product._id === selectedItem._id);
    if (!productData) continue;

    const orderItem = buildOrderItemBase(productData, selectedItem.quantity);
    applyOptionToOrderItem(orderItem, selectedItem.size);
    orderItems.push(orderItem);
  }

  return orderItems;
};

export const buildOrderItemsFromCart = (cartItems, products) => {
  const orderItems = [];

  for (const productId in cartItems) {
    for (const optionKey in cartItems[productId]) {
      const quantity = cartItems[productId][optionKey];
      if (quantity <= 0) continue;

      const productData = products.find((product) => product._id === productId);
      if (!productData) continue;

      const orderItem = buildOrderItemBase(productData, quantity);
      applyOptionToOrderItem(orderItem, optionKey);
      orderItems.push(orderItem);
    }
  }

  return orderItems;
};

export const buildAddressPayload = ({ selectedAddress, formData }) => {
  if (selectedAddress) {
    const name = splitName(selectedAddress.receiverName);
    return {
      firstName: name.firstName,
      lastName: name.lastName,
      email: formData.email || "",
      street: selectedAddress.addressLine,
      city: selectedAddress.city,
      state: selectedAddress.ward,
      phone: selectedAddress.phone,
      receiverName: selectedAddress.receiverName,
      ward: selectedAddress.ward,
      addressLine: selectedAddress.addressLine,
      addressType: selectedAddress.addressType,
      fullAddress: selectedAddress.fullAddress,
    };
  }

  return {
    ...formData,
    receiverName: `${formData.firstName} ${formData.lastName}`.trim(),
    ward: formData.state,
    addressLine: formData.street,
    addressType: "home",
    fullAddress: `${formData.street}, ${formData.state}, ${formData.city}`,
  };
};

