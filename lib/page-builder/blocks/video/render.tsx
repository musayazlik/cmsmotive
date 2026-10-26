import type { PuckComponent } from "@puckeditor/core";
import { ConsentVideo } from "../../interactive/consent-video";
import type { VideoProps } from "./schema";

export const VideoRender: PuckComponent<VideoProps> = ({
  provider,
  videoId,
  title,
  poster,
  aspectRatio,
  id,
}) => {
  if (!videoId) {
    return (
      <div data-pb={id} className="pb-video pb-video--empty">
        <span className="pb-video-placeholder">No video ID specified</span>
      </div>
    );
  }

  return (
    <div data-pb={id} className="pb-video-wrapper">
      <ConsentVideo
        provider={provider}
        videoId={videoId}
        title={title}
        poster={poster}
        aspectRatio={aspectRatio}
      />
    </div>
  );
};
