'use client';

import React, { useState, useRef, useEffect } from 'react';

const ImageWorkerPage = () => {
  const [localImage, setLocalImage] = useState<string>('/pic.jpg');
  const [urlImage, setUrlImage] = useState<string>('https://images.unsplash.com/photo-1501854140801-50d01698950b?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=6000&h=4000');
  const [corsStatus, setCorsStatus] = useState<string>('检测中...');
  const [maxWidth, setMaxWidth] = useState<number>(800);
  const [maxHeight, setMaxHeight] = useState<number>(600);
  const [compressionStatus, setCompressionStatus] = useState<string>('等待压缩');
  const [compressedImageUrl, setCompressedImageUrl] = useState<string>('');
  const [compressedLocalImageUrl, setCompressedLocalImageUrl] = useState<string>('');
  const [compressorWorker, setCompressorWorker] = useState<Worker | null>(null);
  
  // 备用的支持CORS的图片URL列表（10MB左右的大图片）
  const corsSafeImageUrls = [
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=6000&h=4000',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=8000&h=5000',
    'https://images.unsplash.com/photo-1426604966848-d7adac402bff?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=7000&h=4500',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?ixlib=rb-4.0.3&q=95&fm=jpg&crop=entropy&cs=srgb&w=9000&h=6000'
  ];
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('等待处理');
  const [worker, setWorker] = useState<Worker | null>(null);
  
  const localImageRef = useRef<HTMLImageElement>(null);
  const urlImageRef = useRef<HTMLImageElement>(null);

  // 初始化 Web Worker
  useEffect(() => {
    const workerInstance = new Worker('/image-worker.js');
    
    workerInstance.onmessage = (e) => {
      const { type, data } = e.data;
      
      if (type === 'processed') {
        setStatus('图片处理完成！');
        setProcessing(false);
        console.log('处理后的图片数据:', data);
      } else if (type === 'error') {
        setStatus(`处理错误: ${data}`);
        setProcessing(false);
      }
    };
    
    workerInstance.onerror = (error) => {
      setStatus(`Worker 错误: ${error.message}`);
      setProcessing(false);
    };
    
    setWorker(workerInstance);
    
    return () => {
      workerInstance.terminate();
    };
  }, []);
  
  
  // 初始化图片压缩 Worker
  useEffect(() => {
    const workerInstance = new Worker('/image-compressor.js');
    
    workerInstance.onmessage = (e) => {
      const { type, result, error, imageType, message } = e.data;
      
      // 处理日志消息
      if (type === 'log') {
        console.log(message);
        return;
      }
      
      if (type === 'compressed') {
        // 将压缩后的 ImageBitmap 转换为 URL 用于显示
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = result.width;
          canvas.height = result.height;
          ctx.drawImage(result, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              
              // 根据图片类型设置对应的URL
              if (imageType === 'local') {
                setCompressedLocalImageUrl(url);
                console.log(`[图片压缩] 本地图片压缩完成 - 新尺寸: ${result.width}x${result.height}`);
              } else if (imageType === 'url') {
                setCompressedImageUrl(url);
                console.log(`[图片压缩] URL图片压缩完成 - 新尺寸: ${result.width}x${result.height}`);
              }
              
              // 检查是否两个图片都压缩完成了
              if ((imageType === 'local' && compressedImageUrl) || 
                  (imageType === 'url' && compressedLocalImageUrl) ||
                  (compressedImageUrl && compressedLocalImageUrl)) {
                setCompressionStatus('压缩完成');
              } else {
                setCompressionStatus('正在压缩中...');
              }
            }
          }, 'image/jpeg', 0.8);
        }
      } else if (type === 'error') {
        setCompressionStatus(`压缩错误: ${error}`);
        console.error('[图片压缩] 压缩失败:', error);
      }
    };
    
    workerInstance.onerror = (error) => {
      setCompressionStatus(`Worker 错误: ${error.message}`);
      console.error('[图片压缩] Worker 错误:', error);
    };
    
    setCompressorWorker(workerInstance);
    
    return () => {
      workerInstance.terminate();
      if (compressedImageUrl) {
        URL.revokeObjectURL(compressedImageUrl);
      }
      if (compressedLocalImageUrl) {
        URL.revokeObjectURL(compressedLocalImageUrl);
      }
    };
  }, [compressedImageUrl]);
  
  // 检测图片跨域状态
  useEffect(() => {
    if (urlImageRef.current) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            ctx.getImageData(0, 0, canvas.width, canvas.height);
            setCorsStatus('✅ 支持CORS');
          }
        } catch (error) {
          setCorsStatus('❌ 存在跨域限制');
        }
      };
      img.onerror = () => {
        setCorsStatus('❌ 图片加载失败');
      };
      img.src = urlImage;
    }
  }, [urlImage]);

  // 图片转换为可传递给 Web Worker 的数据格式
  const imageToWorkerData = (img: HTMLImageElement): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      console.log(`[图片转换] 开始转换图片: ${img.src.substring(0, 100)}...`);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        const endTime = performance.now();
        console.log(`[图片转换] 失败 - 无法获取 canvas 上下文，耗时: ${(endTime - startTime).toFixed(2)}ms`);
        reject(new Error('无法获取 canvas 上下文'));
        return;
      }
      
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      try {
        const drawStartTime = performance.now();
        ctx.drawImage(img, 0, 0);
        const drawEndTime = performance.now();
        console.log(`[图片转换] 绘制图片到 canvas 耗时: ${(drawEndTime - drawStartTime).toFixed(2)}ms`);
        
        const getDataStartTime = performance.now();
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const getDataEndTime = performance.now();
        console.log(`[图片转换] 获取 ImageData 耗时: ${(getDataEndTime - getDataStartTime).toFixed(2)}ms`);
        
        const totalTime = performance.now() - startTime;
        console.log(`[图片转换] 转换完成 - 尺寸: ${imageData.width}x${imageData.height}, 总耗时: ${totalTime.toFixed(2)}ms`);
        
        resolve(imageData);
      } catch (error) {
        const endTime = performance.now();
        console.log(`[图片转换] 失败 - 耗时: ${(endTime - startTime).toFixed(2)}ms, 错误: ${error}`);
        
        // 如果是跨域错误，尝试使用代理或其他方法
        if (error instanceof DOMException && error.name === 'SecurityError') {
          reject(new Error('跨域图片无法直接处理，请使用支持CORS的图片或本地图片'));
        } else {
          reject(error);
        }
      }
    });
  };

  // 检查图片是否可以安全地用于canvas
  const checkImageCorsSafety = (img: HTMLImageElement): boolean => {
    // 检查图片是否同源
    if (img.src.startsWith(window.location.origin) || img.src.startsWith('/')) {
      return true;
    }
    
    // 检查是否设置了crossOrigin属性
    if (img.crossOrigin === 'anonymous' || img.crossOrigin === 'use-credentials') {
      return true;
    }
    
    return false;
  };

  // 压缩图片
  const compressImage = async () => {
    if (!urlImage || !compressorWorker) {
      setCompressionStatus('请确保图片URL已设置');
      return;
    }

    setCompressionStatus('正在压缩图片...');
    setCompressedImageUrl('');
    setCompressedLocalImageUrl('');
    
    try {
      console.log(`[图片压缩] 开始压缩对比测试 - URL图片: ${urlImage.substring(0, 100)}..., 本地图片: ${localImage}`);
      
      // 压缩URL图片
      compressorWorker.postMessage({
        type: 'compress',
        imageUrl: urlImage,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageType: 'url'
      });
      
      // 压缩本地图片
      compressorWorker.postMessage({
        type: 'compress',
        imageUrl: localImage,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageType: 'local'
      });
      
    } catch (error) {
      setCompressionStatus(`压缩失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('[图片压缩] 发送消息失败:', error);
    }
  };

  // 处理图片
  const processImages = async () => { 
    if (!localImageRef.current || !urlImageRef.current || !worker) {
      setStatus('请确保图片已加载完成');
      return;
    }

    setProcessing(true);
    setStatus('正在处理图片...');

    try {
      // 转换本地图片
      const localImageData = await imageToWorkerData(localImageRef.current);
      
      // 检查URL图片的跨域安全性
      if (!checkImageCorsSafety(urlImageRef.current)) {
        throw new Error('网络图片存在跨域限制，无法处理');
      }
      
      // 转换URL图片
      const urlImageData = await imageToWorkerData(urlImageRef.current);
      
      // 发送到 Web Worker
      worker.postMessage({
        type: 'processImages',
        data: {
          localImage: {
            data: localImageData.data.buffer,
            width: localImageData.width,
            height: localImageData.height
          },
          urlImage: {
            data: urlImageData.data.buffer,
            width: urlImageData.width,
            height: urlImageData.height
          }
        }
      }, [
        localImageData.data.buffer,
        urlImageData.data.buffer
      ]);
      
    } catch (error) {
      setStatus(`转换失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Web Worker 图片处理器
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            使用 Web Worker 在后台处理图片数据，不会阻塞主线程
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* 本地图片 */}
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">本地图片</h2>
              {localImage ? (
                <div className="space-y-4">
                  <img 
                    ref={localImageRef}
                    src={localImage} 
                    alt="本地图片" 
                    className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                    onLoad={() => setLocalImage(localImage)}
                  />
                  <p className="text-sm text-gray-600">public/pic.jpg</p>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center">
                  <p className="text-gray-500">加载中...</p>
                </div>
              )}
            </div>

            {/* URL图片 */}
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">网络图片</h2>
              {urlImage ? (
                <div className="space-y-4">
                  <img 
                    ref={urlImageRef}
                    src={urlImage} 
                    alt="网络图片" 
                    className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                    crossOrigin="anonymous"
                    onLoad={() => setUrlImage(urlImage)}
                    onError={(e) => {
                      console.error('图片加载失败:', e);
                      setStatus('网络图片加载失败，可能存在跨域问题');
                    }}
                  />
                  <p className="text-sm text-gray-600">来自网络的示例图片</p>
                    <p className="text-sm mt-2">跨域状态: <span className={`font-medium ${corsStatus.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>{corsStatus}</span></p>
                            <div className="mt-3">
                      <button
                onClick={() => {
                  const currentIndex = corsSafeImageUrls.indexOf(urlImage);
                  const nextIndex = (currentIndex + 1) % corsSafeImageUrls.length;
                  setUrlImage(corsSafeImageUrls[nextIndex]);
                  setCorsStatus('检测中...');
                  setCompressedImageUrl('');
                  setCompressedLocalImageUrl('');
                  setCompressionStatus('等待压缩');
                }}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
              >
                切换图片
              </button>
                    </div>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center">
                  <p className="text-gray-500">加载中...</p>
                </div>
              )}
            </div>
          </div>

          {/* 压缩参数设置 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">图片压缩设置</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大宽度 (px)
                </label>
                <input
                  type="number"
                  value={maxWidth}
                  onChange={(e) => setMaxWidth(Number(e.target.value))}
                  min="50"
                  max="4000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  最大高度 (px)
                </label>
                <input
                  type="number"
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(Number(e.target.value))}
                  min="50"
                  max="4000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="text-center space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button
                onClick={processImages}
                disabled={processing || !localImage || !urlImage}
                className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                  processing || !localImage || !urlImage
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {processing ? '处理中...' : '处理图片'}
              </button>
              
              <button
                onClick={compressImage}
                disabled={!urlImage}
                className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
                  !urlImage
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                压缩图片
              </button>
            </div>
            
            <div className="mt-4 space-y-2">
              <p className={`text-lg font-medium ${
                status.includes('错误') ? 'text-red-600' : 
                status.includes('完成') ? 'text-green-600' : 'text-gray-600'
              }`}>
                处理状态: {status}
              </p>
              <p className={`text-lg font-medium ${
                compressionStatus.includes('错误') ? 'text-red-600' : 
                compressionStatus.includes('完成') ? 'text-green-600' : 'text-gray-600'
              }`}>
                压缩状态: {compressionStatus}
              </p>
            </div>
          </div>

          {/* 压缩结果展示 */}
          {(compressedImageUrl || compressedLocalImageUrl) && (
            <div className="mt-8 text-center">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">压缩结果对比</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* URL图片压缩结果 */}
                {compressedImageUrl && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-gray-700 mb-3">URL图片压缩结果</h4>
                    <img 
                      src={compressedImageUrl} 
                      alt="压缩后的URL图片" 
                      className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                    />
                    <p className="text-sm text-gray-600 mt-2">URL图片压缩 (最大尺寸: {maxWidth}x{maxHeight})</p>
                  </div>
                )}
                
                {/* 本地图片压缩结果 */}
                {compressedLocalImageUrl && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-gray-700 mb-3">本地图片压缩结果</h4>
                    <img 
                      src={compressedLocalImageUrl} 
                      alt="压缩后的本地图片" 
                      className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                    />
                    <p className="text-sm text-gray-600 mt-2">本地图片压缩 (最大尺寸: {maxWidth}x{maxHeight})</p>
                  </div>
                )}
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 提示：现在可以同时对比本地图片和URL图片的压缩效果和性能差异
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 功能说明 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">功能说明</h3>
          <ul className="text-left space-y-2 text-gray-600">
            <li>• 展示本地图片和网络图片</li>
            <li>• 将图片转换为 ImageData 格式</li>
            <li>• 使用 Transferable Objects 传递数据</li>
            <li>• Web Worker 处理图片数据</li>
            <li>• 跨域图片检测和处理</li>
            <li>• 不阻塞主线程，界面保持响应</li>
            <li>• 实时状态反馈</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImageWorkerPage;