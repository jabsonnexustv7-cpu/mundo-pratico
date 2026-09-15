import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0?target=es2022';
import { MP_SUPABASE_URL, MP_SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

export const mpSupabase = createClient(MP_SUPABASE_URL, MP_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

export async function getMundoPraticoSession() {
  const { data, error } = await mpSupabase.auth.getUser();
  if (error || !data?.user) return { user: null, hasAccess: false };

  const { data: hasAccess, error: accessError } = await mpSupabase.rpc('mp_has_active_access');
  if (accessError) throw accessError;

  return { user: data.user, hasAccess: Boolean(hasAccess) };
}

export async function loadRecipeCatalog() {
  const { data, error } = await mpSupabase
    .from('mp_recipes')
    .select('id,slug,title,description,servings,prep_minutes,cook_minutes,difficulty,instructions,equipment,tags,image_path,estimated_cost_cents,mp_recipe_ingredients(quantity,unit,is_optional,note,mp_ingredients(id,name,category,base_unit))')
    .eq('is_active', true)
    .order('title');

  if (error) throw error;
  return data ?? [];
}

export async function generateWeekPlan({
  startDate,
  householdSize,
  budgetCents = null,
  goal = 'praticidade',
  equipment = [],
  avoidItems = [],
}) {
  const { data, error } = await mpSupabase.rpc('mp_generate_week_plan', {
    p_start_date: startDate,
    p_household_size: householdSize,
    p_budget_cents: budgetCents,
    p_goal: goal,
    p_equipment: equipment,
    p_avoid_items: avoidItems,
  });

  if (error) throw error;
  return data;
}

export async function findRecipesByIngredients(ingredients, limit = 12) {
  const values = Array.isArray(ingredients)
    ? ingredients
    : String(ingredients ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  if (!values.length) return [];

  const { data, error } = await mpSupabase.rpc('mp_find_recipes_by_ingredients', {
    p_ingredients: values,
    p_limit: limit,
  });

  if (error) throw error;
  return data ?? [];
}

export async function loadShoppingList(shoppingListId) {
  const { data, error } = await mpSupabase
    .from('mp_shopping_list_items')
    .select('id,ingredient_id,item_name,quantity,unit,already_have_quantity,estimated_price_cents,is_checked,mp_ingredients(category)')
    .eq('shopping_list_id', shoppingListId)
    .order('item_name');

  if (error) throw error;
  return data ?? [];
}

export async function setShoppingItemChecked(itemId, isChecked) {
  const { data, error } = await mpSupabase
    .from('mp_shopping_list_items')
    .update({ is_checked: Boolean(isChecked), updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('id,is_checked')
    .single();

  if (error) throw error;
  return data;
}

export async function askMundoPraticoAI(message, mealPlanId = null) {
  const { data, error } = await mpSupabase.functions.invoke('mundo-pratico-ai', {
    body: {
      message: String(message ?? '').trim(),
      meal_plan_id: mealPlanId || null,
    },
  });

  if (error) throw error;
  return data;
}
