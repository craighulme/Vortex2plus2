const COLORS = ['#1a1a1a', '#2563EB', '#16A34A', '#9333EA', '#D97706', '#DC2626', '#0891B2'];
function avatarColor(plrName) {
  let n = 0;
  for (const _0x28a22f of plrName) n = n * 31 + _0x28a22f.charCodeAt(0) & 65535;
  return COLORS[n % COLORS.length];
}
function initial(name) {
  return name[0].toUpperCase();
}
function setupNav(userId) {
  const myProfileBtn = document.getElementById('my-profile-btn');
  if (myProfileBtn) {
    myProfileBtn.href = '/users/' + userId + '/profile';
  }
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    await fetch('/logout', {
      'method': 'POST'
    });
    location.replace('/');
  });
}
function initCarousel(carousel) {
  const friendsRow = carousel.querySelector('.friends-row');
  const previousBtn = carousel.querySelector('.carousel-prev');
  const nextBtn = carousel.querySelector('.carousel-next');
  if (!friendsRow || !previousBtn || !nextBtn) {
    return;
  }
  function updateScrollBtns() {
    previousBtn.hidden = friendsRow.scrollLeft <= 0;
    nextBtn.hidden = friendsRow.scrollLeft + friendsRow.clientWidth >= friendsRow.scrollWidth - 1;
  }
  previousBtn.addEventListener('click', () => friendsRow.scrollBy({
    'left': -200,
    'behavior': 'smooth'
  }));
  nextBtn.addEventListener('click', () => friendsRow.scrollBy({
    'left': 0xc8,
    'behavior': 'smooth'
  }));
  friendsRow.addEventListener('scroll', updateScrollBtns);
  new ResizeObserver(updateScrollBtns).observe(friendsRow);
  updateScrollBtns();
}
