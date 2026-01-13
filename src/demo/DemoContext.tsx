import React, { createContext, useContext, useState, ReactNode } from "react";
import {
  DEMO_REPS,
  DEMO_VENDORS,
  DEMO_COMMUNITY_POSTS,
  DemoRep,
  DemoVendor,
  DemoCommunityPost,
} from "./demoData";

interface DemoContextType {
  // Data
  demoReps: DemoRep[];
  demoVendors: DemoVendor[];
  demoPosts: DemoCommunityPost[];

  // Unlocked reps (simulates credit-based unlock)
  unlockedReps: string[];
  unlockRep: (repId: string) => void;

  // Community interactions
  votePost: (postId: string, voteType: "helpful" | "not_helpful") => void;
  reportPost: (postId: string) => void;

  // Reset demo state
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [unlockedReps, setUnlockedReps] = useState<string[]>([]);
  const [demoPosts, setDemoPosts] = useState<DemoCommunityPost[]>(
    DEMO_COMMUNITY_POSTS
  );

  const unlockRep = (repId: string) => {
    if (!unlockedReps.includes(repId)) {
      setUnlockedReps((prev) => [...prev, repId]);
    }
  };

  const votePost = (postId: string, voteType: "helpful" | "not_helpful") => {
    setDemoPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              helpful_count:
                voteType === "helpful"
                  ? post.helpful_count + 1
                  : post.helpful_count,
              not_helpful_count:
                voteType === "not_helpful"
                  ? post.not_helpful_count + 1
                  : post.not_helpful_count,
            }
          : post
      )
    );
  };

  const reportPost = (postId: string) => {
    setDemoPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, under_review: true }
          : post
      )
    );
  };

  const resetDemo = () => {
    setUnlockedReps([]);
    setDemoPosts(DEMO_COMMUNITY_POSTS);
  };

  return (
    <DemoContext.Provider
      value={{
        demoReps: DEMO_REPS,
        demoVendors: DEMO_VENDORS,
        demoPosts,
        unlockedReps,
        unlockRep,
        votePost,
        reportPost,
        resetDemo,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemoContext must be used within a DemoProvider");
  }
  return context;
}
