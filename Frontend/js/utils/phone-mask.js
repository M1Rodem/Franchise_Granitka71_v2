import { showTempMessage } from './utils.js';

/**
 * Настройка маски для телефона
 * @param {string} elementId - ID элемента input
 */
export function setupPhoneMask(elementId) {
    const input = document.getElementById(elementId);
    if (!input) {
        console.warn(`Элемент #${elementId} не найден для маски телефона`);
        return;
    }
    
    // Проверяем что Inputmask доступен
    if (typeof Inputmask === 'undefined') {
        console.error('Inputmask библиотека не загружена');
        showTempMessage('Ошибка загрузки маски телефона', 'error');
        return;
    }
    
    // Создаем маску
    const mask = new Inputmask({
        mask: '+7 (999) 999-99-99',
        placeholder: '_',
        showMaskOnHover: false,
        clearIncomplete: true,
        showMaskOnFocus: true,
        onBeforePaste: function (pastedValue) {
            // Нормализация вставленного значения
            const numbers = pastedValue.replace(/\D/g, '');
            
            if (numbers.length === 0) return '';
            
            // Обработка форматов: 8..., +7..., 7...
            if (numbers[0] === '8') {
                return '7' + numbers.substring(1);
            } else if (numbers[0] === '7') {
                return numbers;
            } else {
                return '7' + numbers;
            }
        },
        oncomplete: function() {
            // Валидация при завершении ввода
            validatePhoneInput(input);
        },
        onincomplete: function() {
            // Показываем подсказку при неполном вводе
            input.setCustomValidity('Введите полный номер телефона');
        }
    });
    
    mask.mask(input);
    
    // Дополнительная валидация
    input.addEventListener('blur', () => validatePhoneInput(input));
    input.addEventListener('input', () => {
        // Сбрасываем кастомную валидацию при вводе
        input.setCustomValidity('');
    });
}

/**
 * Валидация телефонного ввода
 */
function validatePhoneInput(input) {
    const value = input.value.replace(/\D/g, '');
    
    // Проверяем минимальную длину (11 цифр с кодом страны)
    if (value.length === 11 && value[0] === '7') {
        input.setCustomValidity('');
        return true;
    }
    
    // Проверяем 10 цифр (без кода страны)
    if (value.length === 10) {
        input.setCustomValidity('');
        return true;
    }
    
    // Невалидный номер
    input.setCustomValidity('Введите корректный номер телефона (11 цифр)');
    return false;
}

/**
 * Нормализация телефонного номера для отправки на сервер
 * @param {string} phone - Телефон с маской
 * @returns {string} Нормализованный номер
 */
export function normalizePhoneForSubmit(phone) {
    if (!phone) return '';
    
    // Убираем все нецифровые символы
    const digits = phone.replace(/\D/g, '');
    
    // Если номер начинается с 8, заменяем на 7
    if (digits.length === 11 && digits[0] === '8') {
        return '7' + digits.substring(1);
    }
    
    // Если 10 цифр (без кода страны), добавляем 7
    if (digits.length === 10) {
        return '7' + digits;
    }
    
    // Возвращаем как есть (сервер сам нормализует)
    return digits;
}

/**
 * Проверка валидности телефона
 * @param {string} phone - Телефон для проверки
 * @returns {boolean} Валидность
 */
export function isValidPhone(phone) {
    if (!phone) return false;
    
    const digits = phone.replace(/\D/g, '');
    
    // Проверяем основные форматы
    if (digits.length === 11 && digits[0] === '7') return true;
    if (digits.length === 10) return true; // Сервер добавит 7
    if (digits.length === 11 && digits[0] === '8') return true; // Сервер заменит на 7
    
    return false;
}