export type YoutubeTimestamp = {
  startTime?: number;
  time?: number;
  endTime?: number;
  topic: string;
};

export type YoutubeVideo = {
  title: string;
  url: string;
  videoId: string;
  channel: string;
  category: string;
  summary: string;
  dateAdded: string;
  timestamps: YoutubeTimestamp[];
  // Set by fetch_youtube.js when Vertex AI permanently can't ingest this video's content
  // (PERMISSION_DENIED — typically the uploader disabled embedding/download access), as opposed
  // to a transient failure worth retrying on a future run. Not read by the frontend today (an
  // empty timestamps array already hides the "Key Moments" section either way) — present here
  // for type accuracy against the real data shape, and in case a future UI wants to tell the two
  // apart (e.g. skip re-showing a "retry" affordance for a video that will never get one).
  enrichmentBlocked?: boolean;
};

declare global {
  interface Window {
    YT: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          videoId: string;
          playerVars: Record<string, number>;
          events: {
            onReady: () => void;
            onStateChange: (event: { data: number }) => void;
          };
        },
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type YTPlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  cueVideoById: (videoId: string) => void;
  getDuration: () => number;
  destroy?: () => void;
};
