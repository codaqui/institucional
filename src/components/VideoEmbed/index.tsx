import React from "react";
import styles from "./index.module.css";

type Props = {
  readonly url: string;
  readonly title?: string;
  readonly caption?: string;
};

function getYouTubeId(url: string): string | null {
  const match =
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/.exec(
      url
    );
  return match ? match[1] : null;
}

export default function VideoEmbed({ url, title = "Vídeo", caption }: Props): React.JSX.Element {
  const videoId = getYouTubeId(url);
  const src = videoId
    ? `https://www.youtube.com/embed/${videoId}`
    : url;

  return (
    <figure className={styles.wrapper}>
      <div className={styles.container}>
        <iframe
          title={title || 'Vídeo'}
          className={styles.iframe}
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
