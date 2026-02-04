interface ImageAttachmentsProps {
    images: File[];
}

const ImageAttachments: React.FC<ImageAttachmentsProps> = ({ images }) => {
    if (images.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 mb-3">
            {images.map((file, idx) => (
                <div
                    key={`${file.name}-${idx}`}
                    className="w-16 h-16 rounded-md border overflow-hidden"
                >
                    <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                    />
                </div>
            ))}
        </div>
    );
};

export default ImageAttachments;
