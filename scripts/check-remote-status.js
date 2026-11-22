// Diagnostic: what does the app's ANON key actually see in Supabase?
// The desktop app writes with anon (POST app_users) and reads statuses
// from the app_user_status view. This script does exactly both reads.
// Run:  node scripts/check-remote-status.js
const url = 'https://ttmjcjvthrnzyiifdqht.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0bWpjanZ0aHJuenlpaWZkcWh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxNTI1MDIsImV4cCI6MjExMDcyODUwMn0.mCWYnB_Sys3hYA8OaZYU3QzAP_ZBM6XW8PHu86a3ps8'

async function main() {
  // 0) RPC — the app's preferred read path (SECURITY DEFINER function)
  try {
    const res = await fetch(url + '/rest/v1/rpc/get_app_user_status', {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    })
    console.log('rpc get_app_user_status -> HTTP', res.status)
    console.log(await res.text())
  } catch (e) {
    console.log('rpc get_app_user_status -> NETWORK ERROR:', e.message)
  }

  // 1) status view — legacy/fallback read path
  try {
    const res = await fetch(url + '/rest/v1/app_user_status?select=username,status', {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    })
    console.log('app_user_status view -> HTTP', res.status)
    console.log(await res.text())
  } catch (e) {
    console.log('app_user_status view -> NETWORK ERROR:', e.message)
  }

  // 2) direct table read — should FAIL for anon (by design); confirms RLS is on
  try {
    const res = await fetch(url + '/rest/v1/app_users?select=username,status', {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    })
    console.log('\napp_users table (anon) -> HTTP', res.status)
    console.log((await res.text()).slice(0, 300))
  } catch (e) {
    console.log('\napp_users table (anon) -> NETWORK ERROR:', e.message)
  }
}
main()
