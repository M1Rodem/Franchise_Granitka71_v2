async function uploadPhoto(orderId, file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`/api/photos/upload/${orderId}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }

        const result = await response.json();
        console.log('Фото загружено:', result);
        return result;
    } catch (error) {
        console.error('Ошибка:', error);
        throw error;
    }
}

// Использование
document.getElementById('photoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            await uploadPhoto(123, file); // orderId нужно передать
            alert('Фото успешно загружено!');
        } catch (error) {
            alert('Ошибка загрузки фото');
        }
    }
});