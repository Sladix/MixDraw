import { createContext, useContext, useState, ReactNode } from 'react';

interface TimelineContextType {
  showTimelinePanel: boolean;
  selectedParam: string | null;
  scrubberPosition: number;
  openTimelinePanel: (paramName: string) => void;
  closeTimelinePanel: () => void;
  setScrubberPosition: (position: number) => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [showTimelinePanel, setShowTimelinePanel] = useState(false);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [scrubberPosition, setScrubberPosition] = useState(0.5);

  const openTimelinePanel = (paramName: string) => {
    setSelectedParam(paramName);
    setShowTimelinePanel(true);
  };

  const closeTimelinePanel = () => {
    setShowTimelinePanel(false);
    setSelectedParam(null);
  };

  return (
    <TimelineContext.Provider
      value={{
        showTimelinePanel,
        selectedParam,
        scrubberPosition,
        openTimelinePanel,
        closeTimelinePanel,
        setScrubberPosition
      }}
    >
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimeline must be used within TimelineProvider');
  }
  return context;
}
