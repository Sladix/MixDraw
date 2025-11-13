import { createContext, useContext, useState, ReactNode } from 'react';

interface TimelineContextType {
  showTimelinePanel: boolean;
  selectedParam: string | null;
  openTimelinePanel: (paramName: string) => void;
  closeTimelinePanel: () => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [showTimelinePanel, setShowTimelinePanel] = useState(false);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);

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
      value={{ showTimelinePanel, selectedParam, openTimelinePanel, closeTimelinePanel }}
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
