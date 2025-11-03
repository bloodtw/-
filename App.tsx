import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { CleaningScheduleData } from './types';
import { extractScheduleFromImages } from './services/geminiService';

const Spinner: React.FC = () => (
  <div className="ml-3 border-4 border-white/30 border-t-white rounded-full w-6 h-6 animate-spin"></div>
);

const App: React.FC = () => {
  const [formData, setFormData] = useState<CleaningScheduleData>({
    area: '',
    name: '',
    phone: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    address: '',
    notes: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [calendarLink, setCalendarLink] = useState<string>('');

  useEffect(() => {
    // Clean up object URLs to prevent memory leaks
    return () => {
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setCalendarLink('');
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedFiles(files);

    // Revoke old previews
    imagePreviews.forEach(url => URL.revokeObjectURL(url));

    if (files.length > 0) {
      // FIX: Cast file to Blob. The error message indicates that 'file' is being inferred as 'unknown',
      // which is incompatible with URL.createObjectURL. This explicit cast resolves the type error.
      const newPreviews = files.map(file => URL.createObjectURL(file as Blob));
      setImagePreviews(newPreviews);
    } else {
      setImagePreviews([]);
    }
  };

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const generateCalendarLink = useCallback((data: CleaningScheduleData, isManual: boolean) => {
    const { date, startTime, endTime, area, name, phone, address, notes } = data;

    if (!date || !startTime || !endTime) {
      setMessage({ text: '錯誤：清潔日期、開始時間和結束時間為必填欄位。', isError: true });
      return;
    }

    const formatDateTime = (dateStr: string, timeStr: string) => {
      try {
        const dt = new Date(`${dateStr}T${timeStr}`);
        if (isNaN(dt.getTime())) throw new Error("Invalid date/time");
        return dt.toISOString().replace(/-|:|\.\d{3}/g, '');
      } catch (error) {
        return null;
      }
    };
    
    const start = formatDateTime(date, startTime);
    const end = formatDateTime(date, endTime);

    if (!start || !end) {
      setMessage({ text: '錯誤：日期時間格式無效，請檢查日期與時間欄位。', isError: true });
      return;
    }
    
    const titleParts = [area, name, phone].filter(p => p).join(' | ');
    const eventTitle = `【清潔排班】${titleParts || '新預約'}`;
    const eventDetails = `服務地址：${address}\n${notes ? `清潔要求/備註：${notes}` : ''}`.trim();

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: eventTitle,
      dates: `${start}/${end}`,
      details: eventDetails,
      location: address,
      ctz: 'Asia/Taipei',
    });
    
    const finalUrl = `https://www.google.com/calendar/render?${params.toString()}`;

    setCalendarLink(finalUrl);
    window.open(finalUrl, '_blank');
    
    if (isManual) {
        setMessage({ text: '手動生成成功，已開啟 Google 日曆事件頁面。', isError: false });
    } else {
        setMessage({ text: 'AI 識別成功，已自動填表並開啟日曆頁面。', isError: false });
    }
  }, []);

  const handleProcessImages = async () => {
    if (selectedFiles.length === 0) {
      setMessage({ text: '錯誤：請先上傳包含預約資訊的圖片檔案。', isError: true });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setCalendarLink('');

    try {
      const imagePartsPromises = selectedFiles.map(async (file) => ({
          inlineData: {
              data: await fileToBase64(file),
              mimeType: file.type,
          }
      }));

      const imageParts = await Promise.all(imagePartsPromises);
      const extractedData = await extractScheduleFromImages(imageParts);
      
      setFormData(extractedData);
      generateCalendarLink(extractedData, false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '發生未知錯誤。';
      setMessage({ text: `自動識別失敗：${errorMessage} 請檢查圖片清晰度，或手動輸入資料。`, isError: true });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-0 sm:p-4 bg-slate-100">
      <div className="w-full max-w-md bg-white p-5 sm:p-8 sm:rounded-2xl sm:shadow-lg">
        <header className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2 leading-tight">
                ✨ AI 清潔排班神器
            </h1>
            <p className="text-base text-gray-600 font-semibold leading-relaxed">
                📸 上傳訂單/對話截圖，AI 自動填表並生成 Google 日曆事件！
            </p>
        </header>

        <main>
          <div className="mb-5 pb-3 border-b border-dashed border-gray-300">
            <label htmlFor="imageUpload" className="block text-lg font-bold text-gray-700 mb-2 text-center">步驟一：上傳預約圖片 (可多張)</label>
            <input 
              type="file" 
              id="imageUpload" 
              accept="image/*" 
              multiple 
              onChange={handleFileChange}
              className="w-full text-base text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:bg-gray-200 hover:file:bg-gray-300 transition-colors"
            />
            {imagePreviews.length > 0 && (
              <div id="imagePreviewContainer" className="mt-3 grid grid-cols-3 gap-2">
                {imagePreviews.map((src, index) => (
                  <div key={index} className="w-full h-24 border border-gray-300 rounded-lg overflow-hidden">
                    <img src={src} alt={`圖片預覽 ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mb-6">
            <button 
              id="processBtn" 
              onClick={handleProcessImages}
              disabled={isLoading}
              className="w-full px-6 py-4 bg-green-600 text-white font-extrabold text-xl rounded-2xl shadow-lg hover:bg-green-700 transition duration-200 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 flex items-center justify-center transform hover:scale-[1.01] active:scale-[0.99] disabled:bg-green-400 disabled:cursor-not-allowed"
            >
              <span id="buttonText">{isLoading ? 'AI 處理中...' : '🤖 AI 自動識別並排班'}</span>
              {isLoading && <Spinner />}
            </button>
            {message && (
                <p className={`mt-3 font-medium text-center ${message.isError ? 'text-red-500' : 'text-green-600'}`}>
                    {message.text}
                </p>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 text-center">步驟二：填寫與修正欄位</h2>

          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-1">區域</label>
                <input type="text" id="area" value={formData.area} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="e.g. 中山區"/>
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">客戶姓名</label>
                <input type="text" id="name" value={formData.name} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="e.g. 王小明"/>
              </div>
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">清潔日期 <span className="text-red-500">*</span></label>
              <input type="date" id="date" value={formData.date} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">清潔時間 <span className="text-red-500">*</span></label>
              <div className="flex space-x-3">
                <div className="flex-1">
                  <label htmlFor="startTime" className="block text-xs font-normal text-gray-500 mb-1">開始</label>
                  <input type="time" id="startTime" value={formData.startTime} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"/>
                </div>
                <div className="flex-1">
                  <label htmlFor="endTime" className="block text-xs font-normal text-gray-500 mb-1">結束</label>
                  <input type="time" id="endTime" value={formData.endTime} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"/>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">客戶電話</label>
              <input type="tel" id="phone" value={formData.phone} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="e.g. 0912345678"/>
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">清潔地址 (日曆位置)</label>
              <input type="text" id="address" value={formData.address} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="e.g. 台北市中山區南京東路三段20號"/>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">清潔要求/備註 (日曆說明)</label>
              <textarea id="notes" rows={3} value={formData.notes} onChange={handleFormChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="e.g. 客人要求重點清潔廚房油污"></textarea>
            </div>
          </div>
          
          <div className="mt-6">
            <button 
              id="manualBtn"
              onClick={() => generateCalendarLink(formData, true)}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 transform hover:scale-[1.01] active:scale-[0.99] disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              📅 步驟三：手動生成日曆事件
            </button>
          </div>
          
          {calendarLink && (
            <div id="resultBlock" className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2 text-center">已生成的日曆連結 (可手動複製):</p>
              <a id="calendarLink" href={calendarLink} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-blue-600 hover:text-blue-800 underline block text-center">
                {calendarLink}
              </a>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
