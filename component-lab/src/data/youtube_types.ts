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
