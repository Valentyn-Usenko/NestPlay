import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://ekstysjazqhhlptevjuc.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrc3R5c2phenFoaGxwdGV2anVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODM4MzMsImV4cCI6MjA3Nzk1OTgzM30.GTwr7-AkSkDAKES1ruTvrdp4vHhhI9VtvhkOa0CpeuI"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
