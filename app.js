// 🔴 PASTE YOUR SUPABASE CREDENTIALS HERE
const SUPABASE_URL = 'https://vhleezcqwlhncmewnlzt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VGwe20gaY3FsCcKKq8Zcyw_KGiWTnxJ';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let allListings = [];
let selectedCategory = 'All';

// Modal & UI helpers
function toggleModal(id, show) {
  document.getElementById(id).classList.toggle('hidden', !show);
}

function closeOnBackdrop(e, id) {
  if (e.target.id === id) toggleModal(id, false);
}

function updateFileLabel(input) {
  const label = document.getElementById('fileNameLabel');
  label.textContent = input.files[0] ? `✅ ${input.files[0].name}` : '📸 Tap to upload product photo';
}

function setCategory(cat, btn) {
  selectedCategory = cat;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderFilteredListings();
}

// Auth state
async function checkUser() {
  const { data: { user } } = await db.auth.getUser();
  currentUser = user;

  document.getElementById('openAuthBtn').classList.toggle('hidden', !!user);
  document.getElementById('openSellBtn').classList.toggle('hidden', !user);
  document.getElementById('logoutBtn').classList.toggle('hidden', !user);

  const emailTag = document.getElementById('userEmailTag');
  if (user) {
    emailTag.textContent = user.email.split('@')[0];
    emailTag.classList.remove('hidden');
  } else {
    emailTag.classList.add('hidden');
  }

  fetchListings();
}

async function signup() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return alert('Enter email and password.');

  const { error } = await db.auth.signUp({ email, password });
  if (error) return alert(error.message);

  toggleModal('authModal', false);
  checkUser();
}

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return alert('Enter email and password.');

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  toggleModal('authModal', false);
  checkUser();
}

async function logout() {
  await db.auth.signOut();
  checkUser();
}

// Create listing
async function createListing() {
  const btn = document.getElementById('postBtn');
  const title = document.getElementById('title').value.trim();
  const price = document.getElementById('price').value;
  const category = document.getElementById('category').value;
  const description = document.getElementById('description').value.trim();
  const file = document.getElementById('photo').files[0];

  if (!title || !price) return alert('Title and price are required.');
  btn.disabled = true;
  btn.textContent = 'Publishing...';

  let image_url = '';
  if (file) {
    const cleanName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error: uploadErr } = await db.storage.from('product-images').upload(cleanName, file);
    if (uploadErr) {
      btn.disabled = false;
      btn.textContent = 'Publish Listing';
      return alert('Upload error: ' + uploadErr.message);
    }
    const { data } = db.storage.from('product-images').getPublicUrl(cleanName);
    image_url = data.publicUrl;
  }

  const { error } = await db.from('listings').insert([{
    user_id: currentUser.id,
    seller_email: currentUser.email,
    title,
    price,
    category,
    description,
    image_url,
    status: 'available'
  }]);

  btn.disabled = false;
  btn.textContent = 'Publish Listing';

  if (error) return alert(error.message);

  // Reset form & close modal
  document.getElementById('title').value = '';
  document.getElementById('price').value = '';
  document.getElementById('description').value = '';
  document.getElementById('photo').value = '';
  document.getElementById('fileNameLabel').textContent = '📸 Tap to upload product photo';
  toggleModal('sellModal', false);
  fetchListings();
}

async function toggleSold(id, currentStatus) {
  const newStatus = currentStatus === 'sold' ? 'available' : 'sold';
  await db.from('listings').update({ status: newStatus }).eq('id', id);
  fetchListings();
}

async function deleteListing(id) {
  if (!confirm('Remove this listing permanently?')) return;
  await db.from('listings').delete().eq('id', id);
  fetchListings();
}

// Load & render
async function fetchListings() {
  const { data, error } = await db
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return console.error(error);
  allListings = data || [];
  renderFilteredListings();
}

function renderFilteredListings() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const feed = document.getElementById('feed');

  const filtered = allListings.filter(item => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesText =
      item.title.toLowerCase().includes(query) ||
      (item.description && item.description.toLowerCase().includes(query));
    return matchesCat && matchesText;
  });

  if (!filtered.length) {
    feed.innerHTML = `<p style="color:var(--muted); grid-column:1/-1; text-align:center; padding:40px 0;">No items found. Be the first to list something!</p>`;
    return;
  }

  feed.innerHTML = filtered.map(item => {
    const isOwner = currentUser && currentUser.id === item.user_id;
    const isSold = item.status === 'sold';
    const sellerHandle = item.seller_email ? item.seller_email.split('@')[0] : 'member';

    return `
      <div class="card">
        <div class="img-wrap">
          ${item.image_url ? `<img src="${item.image_url}" alt="${escapeHtml(item.title)}" />` : `<div class="no-img">No photo provided</div>`}
          <span class="cat-badge">${escapeHtml(item.category)}</span>
          ${isSold ? `<div class="sold-overlay">SOLD</div>` : ''}
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <div class="card-price">₱${Number(item.price).toLocaleString()}</div>
          <p class="card-desc">${escapeHtml(item.description || 'No description provided.')}</p>
          <div class="card-footer">
            <span>@${escapeHtml(sellerHandle)}</span>
            <a href="mailto:${encodeURIComponent(item.seller_email || '')}?subject=Interested in ${encodeURIComponent(item.title)}" style="color:#818cf8; text-decoration:none; font-weight:600;">Message →</a>
          </div>
          ${isOwner ? `
            <div class="owner-actions">
              <button class="btn btn-secondary btn-xs" onclick="toggleSold('${item.id}', '${item.status || 'available'}')">
                ${isSold ? 'Relist' : 'Mark Sold'}
              </button>
              <button class="btn btn-danger btn-xs" onclick="deleteListing('${item.id}')">Delete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

checkUser();
