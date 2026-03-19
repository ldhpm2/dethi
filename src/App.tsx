import React, { useState, useRef } from 'react';
import { Upload, FileText, Settings, Play, Download, CheckCircle2, FileCheck, Eye, EyeOff, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker using unpkg which is more reliable for specific versions
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getValidKey = (k: any) => {
  if (!k || typeof k !== 'string') return null;
  const trimmed = k.trim();
  const invalidValues = [
    '', 'undefined', 'null', 'placeholder', 'your_api_key', 
    'my_gemini_api_key', 'enter_your_key', 'api_key_here'
  ];
  if (invalidValues.includes(trimmed.toLowerCase())) return null;
  if (trimmed.length < 10) return null; // Most Gemini keys are longer
  return trimmed;
};

export default function App() {
  const [subject, setSubject] = useState('Toán');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('12');
  const [book, setBook] = useState('Kết nối tri thức');
  const [orientation, setOrientation] = useState('KHTN');
  const [numExams, setNumExams] = useState(1);
  const [requirements, setRequirements] = useState('Bạn là giáo viên dạy giỏi môn toán, chuyên gia ra đề, bạn ra 2 đề giống nhau về câu dẫn chỉ khác số. Câu vận dụng ra ngữ liệu bài toán thực tiễn thường có trong sách kết nối tri thức. Đề cho yêu cầu chuẩn xác để kiểm tra. Nếu có hình thì chèn code tikz.');
  const [isP2Checked, setIsP2Checked] = useState(false);
  const [activeTab, setActiveTab] = useState('exam');
  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  // Auto-hide notification
  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setNotification({ message, type });
  };

  // File states
  const [matrixFile, setMatrixFile] = useState<File | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [deepLearningFile, setDeepLearningFile] = useState<File | null>(null);
  const [matrixContent, setMatrixContent] = useState('');
  const [materialContent, setMaterialContent] = useState('');
  const [deepLearningContent, setDeepLearningContent] = useState('');
  const [curriculumFramework, setCurriculumFramework] = useState('');
  const [isDeepLearning, setIsDeepLearning] = useState(true);
  
  // Question matrix state
  const [questionMatrix, setQuestionMatrix] = useState({
    'Trắc nghiệm 4 phương án': { 'Nhận biết': '0', 'Thông hiểu': '0', 'Vận dụng': '0', 'Vận dụng cao': '0' },
    'Đúng/sai': { 'Nhận biết': '0', 'Thông hiểu': '0', 'Vận dụng': '0', 'Vận dụng cao': '0' },
    'Trả lời ngắn': { 'Nhận biết': '0', 'Thông hiểu': '0', 'Vận dụng': '0', 'Vận dụng cao': '0' },
    'Tự luận': { 'Nhận biết': '0', 'Thông hiểu': '0', 'Vận dụng': '0', 'Vận dụng cao': '0' },
  });

  const [customApiKey, setCustomApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key') || '';
    }
    return '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'active' | 'required'>('required');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected_model') || 'gemini-3-flash-latest';
    }
    return 'gemini-3-flash-latest';
  });

  const hasAutoShown = useRef(false);

  // Auto-show settings modal on mount if no key found
  React.useEffect(() => {
    const key = getValidKey(customApiKey) || getValidKey(process.env.GEMINI_API_KEY);
    if (!key && !hasAutoShown.current) {
      const timer = setTimeout(() => {
        if (!getValidKey(customApiKey) && !getValidKey(process.env.GEMINI_API_KEY)) {
          setShowSettingsModal(true);
          hasAutoShown.current = true;
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Clear modal error when user types
  React.useEffect(() => {
    if (modalError) setModalError(null);
  }, [customApiKey]);

  const [isTestingKey, setIsTestingKey] = useState(false);

  const handleTestKey = async () => {
    const key = getValidKey(customApiKey);
    if (!key) {
      setModalError("Vui lòng nhập API Key hợp lệ (ít nhất 10 ký tự).");
      return;
    }

    setIsTestingKey(true);
    setModalError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      // Simple probe request
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Hi",
      });
      if (response.text) {
        showNotification("API Key hoạt động tốt!", "success");
        setModalError(null);
      }
    } catch (error: any) {
      console.error("Key test error:", error);
      const msg = error?.message || "";
      if (msg.includes("API_KEY_INVALID") || msg.includes("401") || msg.includes("403")) {
        setModalError("API Key không hợp lệ. Vui lòng kiểm tra lại.");
      } else if (msg.includes("quota") || msg.includes("429")) {
        setModalError("API Key đã hết hạn hoặc hết hạn mức (Quota).");
      } else {
        setModalError("Lỗi khi kiểm tra Key: " + (msg.substring(0, 50) || "Không xác định"));
      }
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSaveSettings = () => {
    const trimmedKey = customApiKey.trim();
    const validKey = getValidKey(trimmedKey);
    
    if (trimmedKey && !validKey) {
      setModalError("API Key không đúng định dạng hoặc quá ngắn.");
      return;
    }

    if (trimmedKey) {
      localStorage.setItem('gemini_api_key', trimmedKey);
      setCustomApiKey(trimmedKey);
      setApiKeyStatus('active');
    } else {
      localStorage.removeItem('gemini_api_key');
      setCustomApiKey('');
      setApiKeyStatus('required');
    }
    localStorage.setItem('selected_model', selectedModel);
    setShowSettingsModal(false);
    showNotification('Đã lưu cấu hình thành công!', 'success');
  };

  // Check for API key on mount and when window gains focus
  React.useEffect(() => {
    const checkKey = () => {
      const key = getValidKey(customApiKey) || getValidKey(process.env.GEMINI_API_KEY);
      if (key) {
        setApiKeyStatus('active');
      } else {
        setApiKeyStatus('required');
      }
    };
    
    checkKey();
    window.addEventListener('focus', checkKey);
    return () => window.removeEventListener('focus', checkKey);
  }, [customApiKey]);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const fileInputRef3 = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'matrix' | 'material' | 'deep') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showNotification(`Đang xử lý file ${file.name}...`, 'success');
      const arrayBuffer = await file.arrayBuffer();
      let content = '';

      if (file.name.toLowerCase().endsWith('.docx')) {
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          content = result.value
            .replace(/<p>/g, '\n')
            .replace(/<\/p>/g, '')
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/&nbsp;/g, ' ');
        } catch (docxErr) {
          console.error("Mammoth error:", docxErr);
          throw new Error("Không thể đọc định dạng .docx. File có thể bị hỏng hoặc được bảo vệ.");
        }
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        try {
          // Ensure worker is set before getting document
          if (!pdfjs.GlobalWorkerOptions.workerSrc) {
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
          }
          
          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str || '')
              .join(' ');
            fullText += pageText + '\n';
          }
          content = fullText;
          
          if (!content.trim()) {
            throw new Error("File PDF không chứa văn bản có thể trích xuất (có thể là file ảnh scan).");
          }
        } catch (pdfError: any) {
          console.error("PDF.js error:", pdfError);
          throw new Error(pdfError.message || "Lỗi khi xử lý file PDF. Vui lòng thử lại.");
        }
      } else {
        throw new Error("Định dạng file không hỗ trợ. Vui lòng sử dụng .docx hoặc .pdf");
      }

      // Limit content length
      const MAX_CONTENT_LENGTH = 2000000;
      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.substring(0, MAX_CONTENT_LENGTH) + "\n... [Nội dung bị cắt bớt] ...";
        showNotification(`Cảnh báo: Nội dung file quá lớn và đã được cắt bớt.`, 'warning');
      }

      // Update states only on success
      if (type === 'matrix') {
        setMatrixFile(file);
        setMatrixContent(content);
      } else if (type === 'material') {
        setMaterialFile(file);
        setMaterialContent(content);
      } else if (type === 'deep') {
        setDeepLearningFile(file);
        setDeepLearningContent(content);
      }
      
      showNotification(`Đã tải thành công: ${file.name}`, 'success');
    } catch (error: any) {
      console.error("File upload error:", error);
      showNotification(error.message || `Lỗi khi đọc file ${file.name}.`, 'error');
      
      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const handleGenerate = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setOutput('');

    try {
      const apiKey = getValidKey(customApiKey) || getValidKey(process.env.GEMINI_API_KEY);
      
      let apiKeys: string[] = [];
      if (apiKey) {
        apiKeys = apiKey.split(',').map(k => k.trim()).filter(k => k);
      }

      if (apiKeys.length === 0) {
        setModalError("Vui lòng nhập API Key hợp lệ để tiếp tục.");
        setShowSettingsModal(true);
        setOutput("Vui lòng cấu hình API Key trong phần thiết lập để tiếp tục.");
        setIsLoading(false);
        return;
      } else {
        setApiKeyStatus('active');
      }
      
      const prompt = `
        Bạn là chuyên gia ra đề thi THPT quốc gia. Hãy tạo một đề thi/bài tập chi tiết dựa trên các thông tin sau:
        
        1. THÔNG TIN CHUNG:
        - Môn: ${subject}
        - Chủ đề: ${topic || 'Theo dữ liệu đầu vào'}
        - Lớp: ${grade}
        - Bộ sách: ${book}
        - Định hướng: ${orientation}
        - Số lượng đề cần tạo: ${numExams} đề khác nhau (mã đề khác nhau)
        - Chế độ chấm điểm P2: ${isP2Checked ? 'Bật (4-0-0-0)' : 'Tắt'}
        - Chế độ Học sâu (Deep Learning): ${isDeepLearning ? 'Bật (Yêu cầu phân tích cực kỹ tài liệu)' : 'Tắt'}

        2. PHÂN BỐ ĐỘ KHÓ & LOẠI CÂU HỎI:
        ${Object.entries(questionMatrix).map(([type, levels]) => {
          const counts = Object.entries(levels)
            .filter(([_, count]) => parseInt(count as string) > 0)
            .map(([level, count]) => `${level}: ${count} câu`)
            .join(', ');
          return counts ? `- ${type}: ${counts}` : '';
        }).filter(Boolean).join('\n        ')}

        3. ĐỊNH NGHĨA MỨC ĐỘ:
        - Nhận biết: Áp dụng trực tiếp công thức, định nghĩa cơ bản, không cần biến đổi phức tạp.
        - Thông hiểu: Cần biến đổi nhẹ, hiểu bản chất kiến thức hoặc nhận diện hình ảnh/đồ thị trước khi tính toán.
        - Vận dụng: Kết hợp nhiều bước giải, liên kết nhiều mảng kiến thức, giải quyết các tình huống toán học phức tạp.
        - Vận dụng cao: Dạng bài tổng hợp, tư duy logic sâu, bài toán cực trị hoặc ứng dụng thực tế có độ khó cao.

        4. CẤU TRÚC CÂU HỎI BẮT BUỘC:
        Đề thi phải được chia thành các phần rõ rệt theo cấu trúc đề thi mới của Bộ GD&ĐT:
        - PHẦN I: Câu hỏi trắc nghiệm nhiều lựa chọn (4 lựa chọn A, B, C, D).
        - PHẦN II: Câu hỏi trắc nghiệm Đúng/Sai (Mỗi câu có 4 ý a, b, c, d).
        - PHẦN III: Câu hỏi trắc nghiệm trả lời ngắn (Học sinh điền kết quả số).
        - PHẦN IV (Nếu có): Câu hỏi tự luận.

        5. TIÊU CHUẨN CHẤT LƯỢNG:
        - Các phương án nhiễu (distractors) phải cực kỳ hợp lý, dựa trên các sai lầm phổ biến của học sinh khi tính toán hoặc hiểu nhầm khái niệm.
        - Tuyệt đối không trùng lặp dữ kiện hoặc dạng bài giữa các câu hỏi.
        - Phân hóa học sinh rõ rệt theo đúng tỷ lệ các mức độ đã nêu.
        - Đúng chuẩn chương trình giáo dục phổ thông 2018 và định hướng thi tốt nghiệp THPT mới.
        - Có lời giải ngắn gọn, súc tích, trình bày rõ ràng các bước then chốt cho từng câu.
        - Xuất bản dưới dạng Markdown kết hợp LaTeX chuẩn mực.

        5. KHUNG CHƯƠNG TRÌNH & YÊU CẦU CẦN ĐẠT (CHUYÊN SÂU):
        ${curriculumFramework ? `--- KHUNG KẾ HOẠCH DẠY HỌC ---\n${curriculumFramework}\n` : '--- KHÔNG CÓ KHUNG CHƯƠNG TRÌNH RIÊNG (Hãy sử dụng kiến thức chuẩn của bộ sách) ---'}

        5. DỮ LIỆU ĐẦU VÀO (Dưới dạng văn bản hoặc HTML có cấu trúc bảng):
        ${matrixContent ? `--- NỘI DUNG MA TRẬN/ĐẶC TẢ ---\n${matrixContent}\n` : '--- KHÔNG CÓ FILE MA TRẬN (Hãy tự tạo cấu trúc đề thi chuẩn dựa trên Khung chương trình) ---'}
        ${materialContent ? `--- NỘI DUNG TÀI LIỆU ÔN TẬP ---\n${materialContent}\n` : '--- KHÔNG CÓ FILE TÀI LIỆU (Hãy sử dụng kiến thức chuẩn của bộ sách và bám sát Yêu cầu cần đạt) ---'}
        ${deepLearningContent ? `--- TÀI LIỆU HỌC SÂU (BỔ SUNG) ---\n${deepLearningContent}\n` : ''}

        LƯU Ý QUAN TRỌNG: 
        ${isDeepLearning ? `
        --- CHẾ ĐỘ HỌC SÂU (DEEP LEARNING) ĐANG BẬT ---
        Bạn phải thực hiện quy trình tư duy 3 bước trước khi viết đề:
        Bước 1: Phân tích tài liệu học sâu để tìm ra các "điểm mù" kiến thức, các lỗi sai kinh điển, và các dạng bài biến tướng phức tạp nhất.
        Bước 2: Đối chiếu tài liệu học sâu với Ma trận đề thi để đảm bảo các câu hỏi Vận dụng cao thực sự mang tính đột phá và sáng tạo.
        Bước 3: Thiết kế các câu hỏi có tính liên môn hoặc tích hợp nhiều mảng kiến thức từ tài liệu học sâu.
        YÊU CẦU: Đề thi phải có ít nhất 20% câu hỏi mang phong cách "Học sâu" - tức là những câu hỏi đòi hỏi học sinh phải hiểu bản chất cực sâu thay vì chỉ áp dụng công thức.
        ` : ''}
        - BẮT BUỘC TẠO RA ĐÚNG ${numExams} ĐỀ THI. Mỗi đề phải có mã đề riêng (ví dụ: Mã đề 101, Mã đề 102...).
        - Các đề phải có cùng cấu trúc ma trận nhưng các câu hỏi phải được thay đổi số liệu, hoán đổi vị trí câu hỏi hoặc thay đổi cách hỏi để tránh gian lận nhưng vẫn đảm bảo độ khó tương đương.
        - Bạn phải phân tích kỹ "KHUNG KẾ HOẠCH DẠY HỌC" để xác định đúng "Yêu cầu cần đạt" của từng bài học. Các câu hỏi trong đề thi phải đo lường được các yêu cầu này.
        - Dữ liệu đầu vào có thể chứa các thẻ HTML như <table>, <tr>, <td> để bảo toàn cấu trúc bảng của ma trận đề thi. Hãy phân tích kỹ các bảng này để hiểu số lượng câu hỏi, mức độ nhận thức và nội dung kiến thức cần ra đề.
        - NẾU CÓ NỘI DUNG ĐỀ GỐC: Bạn phải tạo ra một đề thi mới có cấu trúc các phần, số lượng câu hỏi, phong cách đặt câu hỏi và độ khó tương đương 100% so với đề gốc. Tuy nhiên, nội dung câu hỏi phải được thay đổi hoàn toàn (không sao chép nguyên văn câu hỏi từ đề gốc).
        - ĐẢM BẢO tính khoa học, chính xác của kiến thức và phù hợp với chương trình giáo dục phổ thông mới.

        6. YÊU CẦU BỔ SUNG:
        ${requirements}

        HƯỚNG DẪN TRÌNH BÀY VÀ ĐÁP ÁN:
        - Sử dụng Markdown để định dạng đề thi.
        - KHÔNG ĐƯỢC sử dụng dấu sao đôi (**) để in đậm văn bản. Hãy để văn bản bình thường hoặc dùng các tiêu đề (H1, H2, H3) nếu cần phân cấp.
        - BẮT BUỘC dùng LaTeX ($...$ cho inline và $$...$$ cho block) cho TẤT CẢ các công thức toán học, vật lý, hóa học.
        - Nếu đề bài yêu cầu hình vẽ, hãy chèn mã code (TikZ, Asymptote hoặc mô tả chi tiết) để vẽ hình.
        
        QUY TẮC HIỂN THỊ ĐÁP ÁN TRONG ĐỀ:
        - PHẦN I (Trắc nghiệm 4 lựa chọn): Chỉ gạch chân ký hiệu phương án đúng (A. hoặc B. hoặc C. hoặc D.) ngay trong đề, không gạch chân toàn bộ nội dung phương án (ví dụ: <u>A.</u> Nội dung).
        - PHẦN II (Trắc nghiệm Đúng/Sai): KHÔNG ghi chữ "Đúng" hoặc "Sai" vào sau mỗi ý a, b, c, d. Nếu ý đó Đúng thì gạch chân ký hiệu ý đó (ví dụ: <u>a)</u> Nội dung), nếu ý đó Sai thì không gạch chân (ví dụ: b) Nội dung).
        - PHẦN III (Trả lời ngắn): Ghi đáp án ngay bên dưới mỗi câu hỏi (ví dụ: Đáp án: 12.5).
        
        CẤU TRÚC ĐỀ THI:
        - Tiêu đề đề thi (Trường, Môn, Lớp, Thời gian...)
        - Nội dung các câu hỏi (Phần I, II, III...) với đáp án được tích hợp theo quy tắc trên.
        - PHẦN ĐÁP ÁN CHI TIẾT: Vẫn đặt ở cuối cùng của văn bản để cung cấp lời giải chi tiết và bảng tổng hợp.
      `;

      // Proactive check for prompt length (approx 1M tokens limit)
      if (prompt.length > 3500000) {
        setOutput("Lỗi: Tổng lượng dữ liệu quá lớn. Vui lòng giảm bớt nội dung file hoặc chia nhỏ tài liệu.");
        setIsLoading(false);
        return;
      }

      let success = false;
      let lastError: any = null;

      for (let i = 0; i < apiKeys.length; i++) {
        const currentKey = apiKeys[i];
        try {
          const ai = new GoogleGenAI({ apiKey: currentKey });
          const modelName = selectedModel;
          
          const response = await ai.models.generateContentStream({
            model: modelName,
            contents: prompt,
            config: isDeepLearning ? {
              thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
              temperature: 0.7, // Slightly lower temperature for more focused reasoning
            } : undefined
          });

          let fullText = '';
          for await (const chunk of response) {
            // Remove double asterisks from the chunk text
            const cleanedChunk = (chunk.text || '').replace(/\*\*/g, '');
            fullText += cleanedChunk;
            setOutput(fullText);
          }
          
          success = true;
          break; // Success, exit the retry loop
        } catch (error: any) {
          console.error(`Error with API key index ${i}:`, error);
          lastError = error;
          const errorMessage = error?.message || "";
          
          if ((errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) && i < apiKeys.length - 1) {
            showNotification(`Key thứ ${i + 1} đã hết hạn/quota. Đang tự động chuyển sang key tiếp theo...`, "warning");
            continue; // Try next key
          }
          
          break; // Not a rate limit error, or no more keys to try
        }
      }

      if (!success && lastError) {
        throw lastError; // Throw to the outer catch block for final error handling
      }
    } catch (error: any) {
      console.error("Error generating exam:", error);
      
      const errorMessage = error?.message || "";
      
      // Handle token limit error specifically
      if (errorMessage.includes("exceeds the maximum number of tokens")) {
        setOutput("Lỗi: Nội dung tài liệu quá lớn, vượt quá giới hạn xử lý của AI. Vui lòng sử dụng tài liệu ngắn hơn hoặc chia nhỏ file.");
        return;
      }

      // Handle rate limit / quota exceeded
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        setOutput("Lỗi: Đã vượt quá giới hạn sử dụng (Quota) của API Key hiện tại. Vui lòng sử dụng API Key khác hoặc thử lại sau.");
        showNotification("Đã vượt quá giới hạn API. Vui lòng thử lại sau hoặc đổi API Key.", "error");
        return;
      }

      // If the error suggests the API key is missing or invalid, prompt for configuration
      if (
        errorMessage.includes("Requested entity was not found") || 
        errorMessage.includes("API_KEY") ||
        errorMessage.includes("403") ||
        errorMessage.includes("401") ||
        errorMessage.includes("invalid")
      ) {
        setModalError("API Key không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.");
        setShowSettingsModal(true);
        setOutput("Lỗi API Key hoặc Key không hợp lệ. Vui lòng kiểm tra lại cấu hình.");
      } else {
        setOutput("Đã xảy ra lỗi khi tạo đề thi. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportWord = async () => {
    if (!output) {
      showNotification("Vui lòng tạo đề thi trước khi xuất file!", 'warning');
      return;
    }

    try {
      const lines = output.split('\n');
      const children = [
        new Paragraph({
          text: `ĐỀ THI MÔN ${subject.toUpperCase()} - LỚP ${grade}`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: `Bộ sách: ${book} | Định hướng: ${orientation}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      ];

      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        let headingLevel: any = undefined;
        let text = trimmedLine;

        if (trimmedLine.startsWith('### ')) {
          headingLevel = HeadingLevel.HEADING_3;
          text = trimmedLine.replace('### ', '');
        } else if (trimmedLine.startsWith('## ')) {
          headingLevel = HeadingLevel.HEADING_2;
          text = trimmedLine.replace('## ', '');
        } else if (trimmedLine.startsWith('# ')) {
          headingLevel = HeadingLevel.HEADING_1;
          text = trimmedLine.replace('# ', '');
        }

        // Handle <u> tags for underlining
        const textRuns: TextRun[] = [];
        const parts = text.split(/(<u>.*?<\/u>)/g);
        
        parts.forEach(part => {
          if (part.startsWith('<u>') && part.endsWith('</u>')) {
            const content = part.replace(/<\/?u>/g, '');
            textRuns.push(new TextRun({ text: content, underline: {} }));
          } else if (part) {
            textRuns.push(new TextRun(part));
          }
        });

        children.push(
          new Paragraph({
            children: textRuns,
            heading: headingLevel,
            spacing: { before: 120, after: 120 },
          })
        );
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `De_thi_${subject}_Lop_${grade}.docx`);
    } catch (error) {
      console.error("Error exporting word:", error);
      showNotification("Có lỗi xảy ra khi xuất file Word.", 'error');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto relative">
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-emerald-600 p-6 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Settings size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Cấu hình AI & API Key</h3>
                    <p className="text-emerald-100 text-sm">Thiết lập kết nối để tạo mô phỏng</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Settings size={24} className="rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {modalError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-700"
                  >
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Settings size={16} className="text-red-600" />
                    </div>
                    <p className="text-sm font-bold">{modalError}</p>
                  </motion.div>
                )}

                {/* Section 1: API Key */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-1">
                    1. Google Gemini API Key <span className="text-red-500">*</span>
                  </h4>
                  
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="text-blue-600" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-blue-800 text-sm font-medium">Bạn chưa có API Key? Hãy lấy key miễn phí từ Google:</p>
                      <div className="flex flex-wrap gap-3">
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                        >
                          Lấy API Key ngay <Download size={16} className="-rotate-90" />
                        </a>
                        <a 
                          href="https://ai.google.dev/gemini-api/docs/api-key" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
                        >
                          Xem hướng dẫn chi tiết <Download size={16} className="-rotate-90" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <input 
                      type={showApiKey ? "text" : "password"}
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••••••••••"
                      className="w-full h-14 px-6 bg-gray-50 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Section 2: Model Selection */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold text-gray-800">2. Chọn Model AI Ưu Tiên</h4>
                  <p className="text-gray-500 text-sm">Hệ thống sẽ tự động chuyển đổi sang model khác nếu model bạn chọn gặp sự cố (Fallback).</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { 
                        id: 'gemini-3-flash-preview', 
                        name: 'Gemini 3.0 Flash', 
                        desc: 'Tốc độ cao, chi phí thấp (Khuyên dùng)' 
                      },
                      { 
                        id: 'gemini-3.1-pro-preview', 
                        name: 'Gemini 3.1 Pro', 
                        desc: 'Cân bằng giữa thông minh và tốc độ' 
                      },
                      { 
                        id: 'gemini-3.1-flash-lite-preview', 
                        name: 'Gemini 3.1 Lite', 
                        desc: 'Phiên bản nhẹ, tốc độ cực nhanh' 
                      }
                    ].map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedModel(model.id)}
                        className={cn(
                          "relative p-5 text-left rounded-2xl border-2 transition-all group",
                          selectedModel === model.id 
                            ? "border-emerald-500 bg-emerald-50/30" 
                            : "border-gray-100 hover:border-emerald-200 bg-white"
                        )}
                      >
                        {selectedModel === model.id && (
                          <div className="absolute top-3 right-3 text-emerald-600">
                            <CheckCircle2 size={20} />
                          </div>
                        )}
                        <h5 className="font-bold text-gray-900 mb-1">{model.name}</h5>
                        <p className="text-xs text-gray-500 leading-relaxed">{model.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                <button 
                  onClick={handleTestKey}
                  disabled={isTestingKey || !customApiKey.trim()}
                  className={cn(
                    "px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2",
                    isTestingKey ? "bg-gray-200 text-gray-500" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  )}
                >
                  {isTestingKey ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                  ) : <Play size={14} />}
                  Kiểm tra Key
                </button>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    className="px-6 py-2 text-gray-600 font-bold hover:text-gray-900 transition-colors"
                  >
                    Đóng
                  </button>
                  <button 
                    onClick={handleSaveSettings}
                    className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    Lưu Cấu Hình
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 border-l-4 min-w-[300px]",
              notification.type === 'success' ? "bg-white border-green-500 text-green-800" : 
              notification.type === 'error' ? "bg-white border-red-500 text-red-800" : 
              "bg-white border-amber-500 text-amber-800"
            )}
          >
            <div className={cn(
              "w-2 h-2 rounded-full",
              notification.type === 'success' ? "bg-green-500" : 
              notification.type === 'error' ? "bg-red-500" : 
              "bg-amber-500"
            )} />
            <span className="font-medium text-sm">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <Settings size={14} className="rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section 1: Configuration */}
      <div className="section-container border-t-4 border-t-blue-600">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="section-title !mb-0 text-blue-700">
              <Settings size={22} className="text-blue-600" />
              1. Cấu hình Chuyên gia Ra đề
            </h2>
            <p className="text-[10px] text-gray-400 ml-8 mt-0.5 font-medium uppercase tracking-widest">THPT National Exam Expert Mode</p>
          </div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded border border-gray-100">
            <div className={cn("w-1.5 h-1.5 rounded-full", apiKeyStatus === 'active' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-amber-500 animate-pulse")} />
            {apiKeyStatus === 'active' ? "System: Online" : "System: Key Required"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col gap-1">
            <button 
              onClick={() => fileInputRef1.current?.click()}
              className={cn(
                "flex items-center justify-center gap-2 h-11 px-4 rounded font-medium transition-colors w-full",
                matrixFile ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#007bff] hover:bg-blue-600 text-white"
              )}
            >
              {matrixFile ? <FileCheck size={18} /> : <Upload size={18} />}
              <span className="truncate text-sm">
                {matrixFile ? `Đã tải: ${matrixFile.name}` : "1. Tải Ma trận/Đặc tả hoặc Đề gốc (.docx, .pdf)"}
              </span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef1} 
              className="hidden" 
              accept=".docx,.pdf" 
              onChange={(e) => handleFileChange(e, 'matrix')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <button 
              onClick={() => fileInputRef2.current?.click()}
              className={cn(
                "flex items-center justify-center gap-2 h-11 px-4 rounded font-medium transition-colors w-full",
                materialFile ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#17a2b8] hover:bg-cyan-600 text-white"
              )}
            >
              {materialFile ? <FileCheck size={18} /> : <Upload size={18} />}
              <span className="truncate text-sm">
                {materialFile ? `Đã tải: ${materialFile.name}` : "2. Tải Tài liệu Ôn tập (.docx, .pdf)"}
              </span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef2} 
              className="hidden" 
              accept=".docx,.pdf" 
              onChange={(e) => handleFileChange(e, 'material')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <button 
              onClick={() => fileInputRef3.current?.click()}
              className={cn(
                "flex items-center justify-center gap-2 h-11 px-4 rounded font-medium transition-colors w-full",
                deepLearningFile ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-[#6f42c1] hover:bg-purple-600 text-white"
              )}
            >
              {deepLearningFile ? <FileCheck size={18} /> : <Brain size={18} />}
              <span className="truncate text-sm">
                {deepLearningFile ? `Học sâu: ${deepLearningFile.name}` : "3. Tải Tài liệu Học sâu (.docx, .pdf)"}
              </span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef3} 
              className="hidden" 
              accept=".docx,.pdf" 
              onChange={(e) => handleFileChange(e, 'deep')}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="form-row">
            <label className="input-label">Môn:</label>
            <select 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)}
              className="form-input"
            >
              <option>Toán</option>
              <option>Vật lý</option>
              <option>Hóa học</option>
              <option>Sinh học</option>
              <option>Ngữ văn</option>
              <option>Tiếng Anh</option>
              <option>Lịch sử</option>
              <option>Địa lý</option>
            </select>
          </div>

          <div className="form-row">
            <label className="input-label">Chủ đề:</label>
            <input 
              type="text" 
              value={topic} 
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: Đạo hàm, Vectơ, Sóng cơ..."
              className="form-input"
            />
          </div>

          <div className="form-row">
            <label className="input-label">Lớp:</label>
            <select 
              value={grade} 
              onChange={(e) => setGrade(e.target.value)}
              className="form-input"
            >
              <option>10</option>
              <option>11</option>
              <option>12</option>
            </select>
          </div>

          <div className="form-row">
            <label className="input-label">Sách:</label>
            <select 
              value={book} 
              onChange={(e) => setBook(e.target.value)}
              className="form-input"
            >
              <option>Kết nối tri thức</option>
              <option>Cánh diều</option>
              <option>Chân trời sáng tạo</option>
            </select>
          </div>

          <div className="form-row">
            <label className="input-label">Định hướng:</label>
            <select 
              value={orientation} 
              onChange={(e) => setOrientation(e.target.value)}
              className="form-input"
            >
              <option>KHTN</option>
              <option>KHXH</option>
            </select>
          </div>

          <div className="form-row">
            <label className="input-label">Số đề cần tạo:</label>
            <select 
              value={numExams} 
              onChange={(e) => setNumExams(parseInt(e.target.value))}
              className="form-input"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} đề</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto my-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Loại câu hỏi</th>
                  <th className="px-4 py-3 text-center">Nhận biết</th>
                  <th className="px-4 py-3 text-center">Thông hiểu</th>
                  <th className="px-4 py-3 text-center">Vận dụng</th>
                  <th className="px-4 py-3 text-center">Vận dụng cao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.keys(questionMatrix).map((type) => (
                  <tr key={type} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-700">{type}</td>
                    {['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'].map((level) => (
                      <td key={level} className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <input 
                            type="number" 
                            value={questionMatrix[type as keyof typeof questionMatrix][level as keyof (typeof questionMatrix)['Trắc nghiệm 4 phương án']]} 
                            onChange={(e) => {
                              const newMatrix = { ...questionMatrix };
                              newMatrix[type as keyof typeof questionMatrix][level as keyof (typeof questionMatrix)['Trắc nghiệm 4 phương án']] = e.target.value;
                              setQuestionMatrix(newMatrix);
                            }} 
                            className="w-16 h-8 text-center border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                          />
                          <span className="text-[10px] text-gray-400">Câu</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-row items-start">
            <label className="input-label mt-2">Yêu cầu Ngữ liệu:</label>
            <textarea 
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="form-input min-h-[80px] resize-y"
              placeholder="Nhập yêu cầu đặc biệt cho AI..."
            />
          </div>

          <div className="flex flex-wrap gap-4 py-1">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="p2-check"
                checked={isP2Checked}
                onChange={(e) => setIsP2Checked(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="p2-check" className="text-sm font-medium text-gray-700">
                Chấm điểm tổ hợp P2 (4-0-0-0)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="deep-learning-check"
                checked={isDeepLearning}
                onChange={(e) => setIsDeepLearning(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="deep-learning-check" className="text-sm font-bold text-purple-700 flex items-center gap-1">
                <Brain size={16} /> Chế độ Học sâu (Deep Learning)
              </label>
            </div>
          </div>

          <div className="form-row">
            <label className="input-label">Cấu hình AI:</label>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold hover:bg-emerald-100 transition-colors"
            >
              <Settings size={16} />
              Thiết lập API Key & Model
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <label className="input-label flex items-center gap-2">
              <FileText size={16} />
              Khung chương trình / Chuyên đề chuyên sâu:
            </label>
            <textarea 
              value={curriculumFramework}
              onChange={(e) => setCurriculumFramework(e.target.value)}
              placeholder="Dán Khung kế hoạch dạy học (TT, Bài học, Yêu cầu cần đạt...) vào đây để AI bám sát..."
              className="form-input min-h-[150px] text-xs font-mono leading-relaxed"
            />
            <p className="text-[10px] text-gray-400 italic">
              * AI sẽ phân tích các cột "Yêu cầu cần đạt" trong nội dung này để ra đề chính xác hơn.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Results */}
      <div className="section-container">
        <h2 className="section-title">
          <Play size={20} />
          2. Xử lý Kết quả
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <button 
            onClick={handleGenerate}
            disabled={isLoading}
            className={cn(
              "btn-green flex items-center justify-center gap-2",
              isLoading && "opacity-70 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Play size={20} fill="currentColor" />
            )}
            TẠO ĐỀ THI
          </button>

          <button 
            onClick={handleExportWord}
            className="bg-[#007bff] text-white py-2 px-4 rounded font-bold uppercase flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
          >
            <Download size={20} />
            Xuất File Word (Đẹp, Có Hình/LaTeX)
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button 
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2",
              activeTab === 'matrix' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            Nội dung Ma trận/Đề gốc Tài liệu
          </button>
          <button 
            onClick={() => setActiveTab('exam')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2",
              activeTab === 'exam' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            ĐỀ THI SINH RA (Markdown + LaTeX)
          </button>
          <button 
            onClick={() => setActiveTab('answer')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2",
              activeTab === 'answer' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            ĐÁP ÁN
          </button>
        </div>

        {/* Output Area */}
        <div className="bg-[#f0f2f5] rounded-lg border border-gray-200 min-h-[400px] p-6 overflow-auto">
          {activeTab === 'matrix' ? (
            <div className="text-sm text-gray-700">
              {matrixContent || materialContent ? (
                <div className="prose max-w-none">
                  {matrixContent && (
                    <div className="mb-8">
                      <h3 className="font-bold text-blue-600 mb-4 flex items-center gap-2">
                        <FileText size={18} />
                        Nội dung Ma trận/Đề gốc:
                      </h3>
                      <div 
                        className="bg-white p-4 rounded border border-gray-300 overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: matrixContent }} 
                      />
                    </div>
                  )}
                  {materialContent && (
                    <div>
                      <h3 className="font-bold text-blue-600 mb-4 flex items-center gap-2">
                        <FileText size={18} />
                        Nội dung Tài liệu:
                      </h3>
                      <div 
                        className="bg-white p-4 rounded border border-gray-300 overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: materialContent }} 
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20">
                  <FileText size={48} strokeWidth={1} className="mb-2 opacity-20" />
                  <p>Vui lòng tải lên file ma trận hoặc tài liệu để xem nội dung</p>
                </div>
              )}
            </div>
          ) : (
            output ? (
              <div className="markdown-body">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkMath]} 
                  rehypePlugins={[rehypeKatex]}
                >
                  {output}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 mt-20">
                <FileText size={48} strokeWidth={1} className="mb-2 opacity-20" />
                <p>Nội dung đề thi sẽ hiển thị ở đây sau khi bạn nhấn "TẠO ĐỀ THI"</p>
              </div>
            )
          )}
        </div>
      </div>
      
      <footer className="mt-8 pb-4 text-center text-gray-500 text-sm border-t border-gray-200 pt-4">
        Phát triển bởi Lương Đình Hùng - Zalo: 0986282414 © 2026
      </footer>
    </div>
  );
}
