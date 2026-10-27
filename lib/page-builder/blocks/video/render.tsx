import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { ConsentVideo } from "../../interactive/consent-video";
import type { VideoProps } from "./schema";

export const VideoRender: PuckComponent<VideoProps> = ({
  provider,
  videoId,
  title,
  poster,
  aspectRatio,
  id,
  lang,
  ariaLabel,
}) => {
  if (!videoId) {
    return (
      <div data-pb={id} {...blockAttributes({ id, lang })} className="pb-video pb-video--empty">
        <span className="pb-video-placeholder">No video ID specified</span>
      </div>
    );
  }

  return (
    <div data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="pb-video-wrapper">
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
