import { useRef, useState, useCallback } from 'react';
import type { Character, StoryboardFrame, Scene, Prop } from '../../../types/workflow';

export type OperationType = 
  | 'add_character_to_storyboard'
  | 'remove_character_from_storyboard'
  | 'add_scene_to_storyboard'
  | 'remove_scene_from_storyboard'
  | 'add_prop_to_storyboard'
  | 'remove_prop_from_storyboard'
  | 'apply_character_history'
  | 'apply_scene_history'
  | 'apply_prop_history'
  | 'apply_storyboard_image_history'
  | 'apply_storyboard_video_history'
  | 'add_storyboard'
  | 'delete_storyboard'
  | 'move_storyboard'
  | 'edit_storyboard_text'
  | 'update_project_name'
  | 'update_project_ratio'
  | 'update_project_style';

export interface HistoryState {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  storyboards: StoryboardFrame[];
  projectData: {
    name: string;
    aspectRatio: '16:9' | '9:16';
    styleId?: number;
    visualStyle?: string;
  };
}

export interface HistoryRecord {
  state: HistoryState;
  operation: OperationType;
  description: string;
  timestamp: number;
}

const MAX_HISTORY = 50;

const deepClone = <T,>(obj: T): T => {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
};

export const useUndoRedo = () => {
  const undoStackRef = useRef<HistoryRecord[]>([]);
  const redoStackRef = useRef<HistoryRecord[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const saveState = useCallback((
    state: HistoryState,
    operation: OperationType,
    description: string
  ) => {
    const record: HistoryRecord = {
      state: deepClone(state),
      operation,
      description,
      timestamp: Date.now()
    };

    undoStackRef.current.push(record);
    
    // 限制历史记录数量
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }

    // 新操作发生时清空重做栈
    redoStackRef.current = [];
    
    updateFlags();
  }, [updateFlags]);

  const undo = useCallback((): HistoryState | null => {
    if (undoStackRef.current.length === 0) return null;

    const record = undoStackRef.current.pop()!;
    // 不要将撤回的记录推入 redoStack，而是由 handleUndo 来处理
    
    updateFlags();
    
    return deepClone(record.state);
  }, [updateFlags]);

  const redo = useCallback((): HistoryState | null => {
    if (redoStackRef.current.length === 0) return null;

    const record = redoStackRef.current.pop()!;
    // 不要将重做的记录推入 undoStack，而是由 handleRedo 来处理
    
    updateFlags();
    
    return deepClone(record.state);
  }, [updateFlags]);
  
  // 手动将记录推入 redoStack（由 handleUndo 调用）
  const pushToRedoStack = useCallback((state: HistoryState, operation: OperationType, description: string) => {
    const record: HistoryRecord = {
      state: deepClone(state),
      operation,
      description,
      timestamp: Date.now()
    };
    redoStackRef.current.push(record);
    updateFlags();
  }, [updateFlags]);
  
  // 手动将记录推入 undoStack（由 handleRedo 调用）
  const pushToUndoStack = useCallback((state: HistoryState, operation: OperationType, description: string) => {
    const record: HistoryRecord = {
      state: deepClone(state),
      operation,
      description,
      timestamp: Date.now()
    };
    undoStackRef.current.push(record);
    
    // 限制历史记录数量
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
    
    updateFlags();
  }, [updateFlags]);

  const getLastOperation = useCallback((): string | null => {
    if (undoStackRef.current.length === 0) return null;
    return undoStackRef.current[undoStackRef.current.length - 1].description;
  }, []);

  const getNextOperation = useCallback((): string | null => {
    if (redoStackRef.current.length === 0) return null;
    return redoStackRef.current[redoStackRef.current.length - 1].description;
  }, []);

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    updateFlags();
  }, [updateFlags]);

  return {
    saveState,
    undo,
    redo,
    pushToRedoStack,
    pushToUndoStack,
    canUndo,
    canRedo,
    getLastOperation,
    getNextOperation,
    clear
  };
};
