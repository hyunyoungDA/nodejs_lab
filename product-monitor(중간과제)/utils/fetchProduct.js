const axios = require('axios');

async function fetchProduct(keyword) {
  try {
    const res = await axios.get('https://fakestoreapi.com/products');
    const items = res.data; // res.data -> 전체 상품 배열 
    return items.filter(item =>
      item.title.toLowerCase().includes(keyword.toLowerCase()) && item.price >= 50
      // items는 전체 상품 배열, item은 배열의 각 요소.
    );
  } catch (err) {
    console.error('API 요청 실패:', err.message);
    return [];
  }
}

module.exports = fetchProduct;
