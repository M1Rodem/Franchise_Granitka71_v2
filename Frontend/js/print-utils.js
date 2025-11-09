// print-utils.js - Frontend printing and Excel utilities
import { showTempMessage } from './utils.js';
import { apiService } from './api.js';

/**
 * Скачивание заказа в Excel
 */
export async function downloadOrderExcel(orderId) {
    try {
        const excelBtn = document.getElementById('excelBtn');
        
        if (excelBtn) {
            excelBtn.classList.add('loading', 'print-loading');
            excelBtn.disabled = true;
        }

        // Используем apiService для скачивания Excel
        const response = await apiService.downloadOrderExcel(orderId);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Заказ_${orderId}_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showTempMessage('Excel файл успешно скачан', 'success');
        } else {
            throw new Error('Ошибка при скачивании Excel');
        }
        
    } catch (error) {
        console.error('Download Excel error:', error);
        showTempMessage(`Ошибка при скачивании Excel: ${error.message}`, 'error');
    } finally {
        const excelBtn = document.getElementById('excelBtn');
        if (excelBtn) {
            excelBtn.classList.remove('loading', 'print-loading');
            excelBtn.disabled = false;
        }
    }
}

/**
 * Печать заказа через HTML версию
 */
export async function printOrder(orderId) {
    try {
        const printBtn = document.getElementById('printBtn');
        
        if (printBtn) {
            printBtn.classList.add('loading', 'print-loading');
            printBtn.disabled = true;
        }

        showTempMessage('Подготовка документа для печати...', 'info');

        // Используем apiService для получения HTML
        const htmlContent = await apiService.getOrderHtmlPrint(orderId);
        
        // Создаем окно для печати
        const printWindow = window.open('', '_blank', 'width=1000,height=700');
        
        if (!printWindow) {
            throw new Error('Не удалось открыть окно для печати. Разрешите всплывающие окна.');
        }

        // Вставляем HTML контент
        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Ждем загрузки и запускаем печать
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
                showTempMessage('Документ готов к печати', 'success');
            }, 500);
        };
        
    } catch (error) {
        console.error('Print error:', error);
        showTempMessage(`Ошибка при печати: ${error.message}`, 'error');
    } finally {
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.classList.remove('loading', 'print-loading');
            printBtn.disabled = false;
        }
    }
}

/**
 * Вспомогательная функция для получения текущего ID заказа
 */
export function getCurrentOrderId() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    return isNaN(id) ? null : id;
}