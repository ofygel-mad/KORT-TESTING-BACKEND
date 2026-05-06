import { useState } from 'react';
import { FileText, Download, X } from 'lucide-react';
import type { ChatAttachment } from '../types';
import styles from './AttachmentPreview.module.css';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

interface LightboxProps {
  url: string;
  alt: string;
  onClose: () => void;
}

function Lightbox({ url, alt, onClose }: LightboxProps) {
  return (
    <div className={styles.lightboxBackdrop} onClick={onClose}>
      <button className={styles.lightboxClose} onClick={onClose} aria-label="Закрыть">
        <X size={20} />
      </button>
      <img
        src={url}
        alt={alt}
        className={styles.lightboxImg}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

interface Props {
  attachment: ChatAttachment;
}

export function AttachmentPreview({ attachment }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const downloadUrl = `/api/v1/chat/attachments/${attachment.id}/file`;

  if (isImage(attachment.mime_type)) {
    return (
      <>
        <button
          className={styles.imageBtn}
          onClick={() => setLightboxOpen(true)}
          aria-label="Открыть изображение"
        >
          <img
            src={downloadUrl}
            alt={attachment.file_name}
            className={styles.imageThumbnail}
            loading="lazy"
          />
        </button>
        {lightboxOpen && (
          <Lightbox
            url={downloadUrl}
            alt={attachment.file_name}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <a
      href={downloadUrl}
      className={styles.fileCard}
      download={attachment.file_name}
      target="_blank"
      rel="noreferrer"
    >
      <FileText size={22} className={styles.fileIcon} />
      <div className={styles.fileInfo}>
        <span className={styles.fileName}>{attachment.file_name}</span>
        <span className={styles.fileSize}>{formatBytes(attachment.size_bytes)}</span>
      </div>
      <Download size={14} className={styles.downloadIcon} />
    </a>
  );
}
