export const addItemToCartLocal = (cartItems, itemId, optionKey) => {
  const next = structuredClone(cartItems || {});
  if (!next[itemId]) next[itemId] = {};
  next[itemId][optionKey] = (next[itemId][optionKey] || 0) + 1;
  return next;
};

export const setCartItemQuantityLocal = (cartItems, itemId, optionKey, quantity) => {
  const next = structuredClone(cartItems || {});
  if (!next[itemId]) next[itemId] = {};
  next[itemId][optionKey] = quantity;
  return next;
};

export const getCartCountFromItems = (cartItems) => {
  let totalCount = 0;
  for (const productId in cartItems) {
    for (const optionKey in cartItems[productId]) {
      try {
        if (cartItems[productId][optionKey] > 0) {
          totalCount += cartItems[productId][optionKey];
        }
      } catch (error) {
        console.log(error);
      }
    }
  }
  return totalCount;
};

export const getCartAmountFromItems = (cartItems, products) => {
  let totalAmount = 0;
  for (const productId in cartItems) {
    const itemInfo = products.find((product) => product._id === productId);
    for (const optionKey in cartItems[productId]) {
      try {
        if (cartItems[productId][optionKey] > 0) {
          totalAmount += itemInfo.price * cartItems[productId][optionKey];
        }
      } catch (error) {
        console.log(error);
      }
    }
  }
  return totalAmount;
};
