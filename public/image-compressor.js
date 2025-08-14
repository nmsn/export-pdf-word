async function urlToImageBitmap(imageUrl) {
    try {
        // 使用 fetch 获取图像数据
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 转换为 Blob
        const blob = await response.blob();
        
        // 创建 ImageBitmap
        const imageBitmap = await createImageBitmap(blob);
        return imageBitmap;
    } catch (error) {
        console.error('转换失败:', error);
        throw error;
    }
}

// Worker 代码 (image-processor.js)
self.onmessage = async function(e) {
  debugger;
    // const { type, bitmap } = e.data;
    try {
      // 使用 fetch 获取图像数据
      const response = await fetch(e.data);
      console.log(response)
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      
    // 转换为 Blob
      const blob = await response.blob();
      
      // 创建 ImageBitmap
      const imageBitmap = await createImageBitmap(blob);
        
        
        // 返回结果
      self.postMessage({
          type: 'processed',
          result: imageBitmap
      });
        // return imageBitmap;

    } catch (error) {
       console.error('转换失败:', error);
        throw error;
    }
    
};