const axios = require('axios');

async function buildCarts(product_id, quantity){
  try{
    const today = new Date().toISOString().split('T')[0];

    //fake store api response 구조
    const cartData = {
      userId:1,
      date: today,
      products: [
        {
          productId: product_id,
          quantity: quantity
        }
      ]
    };
    const res = await axios.post('https://fakestoreapi.com/carts', cartData);
    console.log('장바구니에 담겼습니다', res.data);
    return res.data;
  } catch (err){
    console.error('API 요청 실패:', err.message);
    return [];
  }
}

module.exports = buildCarts;