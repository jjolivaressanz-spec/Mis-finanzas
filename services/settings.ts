import { supabase } from './supabase';
import { UserSettings } from '../types';

export const getSettings = async (userId: string): Promise<UserSettings> => {
  const { data, error } = await supabase
    .from('cuenta_ahorro')
    .select('user_id, savings_amount')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching settings:", error);
    throw error;
  }

  if (!data) {
    // If not exists, insert default 100000
    const defaultSettings: UserSettings = { user_id: userId, savings_amount: 100000 };
    const { data: newData, error: insertError } = await supabase
      .from('cuenta_ahorro')
      .insert(defaultSettings)
      .select()
      .single();
      
    if (insertError) {
      console.error("Error inserting default settings:", insertError);
      throw insertError;
    }
    return newData as UserSettings;
  }

  return data as UserSettings;
};

export const updateSavingsAmount = async (userId: string, amount: number): Promise<void> => {
  const { error } = await supabase
    .from('cuenta_ahorro')
    .update({ savings_amount: amount, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error("Error updating savings amount:", error);
    throw error;
  }
};
