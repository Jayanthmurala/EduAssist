export const preprocessImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file);
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Grayscale and Contrast enhancement
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

                // Simple thresholding/contrast boost
                let value = avg;
                if (value < 128) value = Math.max(0, value - 50);
                else value = Math.min(255, value + 50);

                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
            }

            ctx.putImageData(imageData, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    const processedFile = new File([blob], file.name, { type: 'image/jpeg' });
                    resolve(processedFile);
                } else {
                    resolve(file);
                }
            }, 'image/jpeg', 0.9);
        };
        img.onerror = () => resolve(file);
    });
};
