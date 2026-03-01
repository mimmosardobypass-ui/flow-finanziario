import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  user_id: string;
  created_at: string;
  parent_id: string | null;
}

export interface CategoryWithChildren extends Category {
  children: Category[];
}

export function useCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return (data as any[]).map((d) => ({
        ...d,
        parent_id: d.parent_id ?? null,
      })) as Category[];
    },
    enabled: !!user,
  });
}

/** Returns only root categories (no parent) */
export function useRootCategories() {
  const { data: categories = [] } = useCategories();
  return useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
}

/** Returns a hierarchical structure: root categories with their children */
export function useCategoryTree() {
  const { data: categories = [] } = useCategories();

  return useMemo(() => {
    const roots: CategoryWithChildren[] = [];
    const childrenMap = new Map<string, Category[]>();

    // Group children by parent_id
    categories.forEach((cat) => {
      if (cat.parent_id) {
        const arr = childrenMap.get(cat.parent_id) || [];
        arr.push(cat);
        childrenMap.set(cat.parent_id, arr);
      }
    });

    // Build tree
    categories.forEach((cat) => {
      if (!cat.parent_id) {
        roots.push({
          ...cat,
          children: childrenMap.get(cat.id) || [],
        });
      }
    });

    return roots;
  }, [categories]);
}

/** Given a category id, returns the id + all children ids (for filtering) */
export function useGetCategoryWithChildrenIds() {
  const { data: categories = [] } = useCategories();

  return useMemo(() => {
    return (categoryId: string): string[] => {
      if (categoryId === "uncategorized") return [categoryId];
      const ids = [categoryId];
      categories.forEach((c) => {
        if (c.parent_id === categoryId) {
          ids.push(c.id);
        }
      });
      return ids;
    };
  }, [categories]);
}
