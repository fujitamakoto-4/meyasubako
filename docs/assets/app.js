(function(){
  'use strict';

  var NAV = [
    { href:'#/',          label:'トップ',        match:function(h){ return h==='#/' || h===''; } },
    { href:'#/voices',     label:'みんなのお悩み', match:function(h){ return h.indexOf('#/voices')===0; } },
    { href:'#/cases',      label:'解決事例',      match:function(h){ return h.indexOf('#/cases')===0 || h.indexOf('#/case/')===0; } },
    { href:'#/stats',      label:'数字で見る',     match:function(h){ return h==='#/stats'; } },
    { href:'#/policy',     label:'公開の考え方',   match:function(h){ return h==='#/policy'; } },
    { href:'#/mechanism',  label:'仕組み',        match:function(h){ return h==='#/mechanism'; } }
  ];

  var CATEGORIES = [
    { slug:'iryo',     name:'医療・介護・年金' },
    { slug:'gan',      name:'がん・治療と仕事' },
    { slug:'bosai',    name:'防災・道路・インフラ' },
    { slug:'kosodate', name:'子育て・教育' },
    { slug:'keizai',   name:'地域経済・中小企業' },
    { slug:'kotsu',    name:'交通・まちづくり' },
    { slug:'seikatsu', name:'生活環境（騒音・獣害等）' },
    { slug:'sonota',   name:'その他' }
  ];

  // ---------------------------------------------------------------
  // Data state (populated by fetch on startup)
  // ---------------------------------------------------------------
  var CONFIG = {
    siteName:'まこと目安箱', tagline:'市民と議員のコミュニケーションの在り方をアップデート',
    heroTitle:'LINEで地元の悩みを\n政治に届ける',
    heroLead:'議員に会えなくても、\n困りごとはLINEで届きます。\n届いた声と、藤田まことがどう動いたかを、\nここで公開しています。',
    lineAddFriendUrl:'', officeName:'衆議院議員 藤田まこと事務所', officeUrl:'',
    district:'埼玉14区（草加・八潮・三郷）', repoUrl:''
  };
  var VOICES = { generatedAt:null, sample:false, items:[] };
  var STATS = { generatedAt:null, sample:false, total:0, published:0, thisMonth:0, byCategory:{}, byCity:{}, monthly:[] };
  var CASES = { generatedAt:null, items:[] };
  var DATA_READY = false;
  var DATA_ERROR = false;

  function byId(id){
    for (var i=0;i<CASES.items.length;i++){ if (CASES.items[i].id===id) return CASES.items[i]; }
    return null;
  }
  function bySlug(slug){
    for (var i=0;i<CASES.items.length;i++){ if (CASES.items[i].slug===slug) return CASES.items[i]; }
    return null;
  }
  function byVoiceId(id){
    for (var i=0;i<VOICES.items.length;i++){ if (VOICES.items[i].id===id) return VOICES.items[i]; }
    return null;
  }
  function categoryInfo(slug){
    for (var i=0;i<CATEGORIES.length;i++){ if (CATEGORIES[i].slug===slug) return CATEGORIES[i]; }
    return null;
  }
  function categorySlugByName(name){
    for (var i=0;i<CATEGORIES.length;i++){ if (CATEGORIES[i].name===name) return CATEGORIES[i].slug; }
    return null;
  }
  function formatMonth(s){
    if (!s) return '';
    var p = s.split('-');
    return p[0] + '年' + parseInt(p[1],10) + '月';
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function categoryChip(name){
    if (!name) return '';
    return '<span class="chip chip-category">' + esc(name) + '</span>';
  }

  // 改行位置の制御: 設定値の "\n" で区切った各文節を inline-block にし、
  // 幅が足りるときは1行、足りないときは文節の切れ目でのみ折り返す。
  function segs(str){
    return String(str||'').split(/\n/).map(function(t){ return '<span class="seg">' + esc(t) + '</span>'; }).join('');
  }

  function caseCard(c){
    var thumbHtml = c.hero
      ? '<div class="card-thumb"><img src="' + esc(c.hero) + '" alt="' + esc(c.heroAlt||'') + '" loading="lazy"></div>'
      : '';
    var inner =
      thumbHtml +
      '<div class="chip-row">' + categoryChip(c.category) + '</div>' +
      '<h3 class="card-title">' + esc(c.title) + '</h3>' +
      '<p class="card-lead">' + esc(c.summary) + '</p>' +
      '<div class="card-meta">' + esc(c.city) + '　｜　受付：' + formatMonth(c.month) + '<div class="card-readmore" style="margin-top:6px;">事例を読む →</div></div>';
    return '<a href="#/case/' + esc(c.slug) + '" class="card">' + inner + '</a>';
  }

  function categoryTabs(activeSlug){
    return '<button class="tab-btn' + (!activeSlug ? ' active' : '') + '" data-slug="">すべて</button>' +
      CATEGORIES.map(function(c){
        return '<button class="tab-btn' + (activeSlug===c.slug ? ' active' : '') + '" data-slug="' + c.slug + '">' + esc(c.name) + '</button>';
      }).join('');
  }

  // カテゴリ内の項目を、テーマの初出順にグルーピングする（テーマ空文字は「その他のテーマ」に束ねる）
  function groupByTheme(list){
    var order = [];
    var map = {};
    list.forEach(function(v){
      var t = v.theme || 'その他のテーマ';
      if (!map[t]){ map[t] = { theme:t, items:[] }; order.push(t); }
      map[t].items.push(v);
    });
    return order.map(function(t){ return map[t]; });
  }

  function voiceCard(v, idx){
    var relatedCase = v.caseId ? byId(v.caseId) : null;
    var link = relatedCase ? '<div class="card-readmore"><a href="#/case/' + esc(relatedCase.slug) + '">→ 解決事例を読む</a></div>' : '';
    return '' +
      '<div class="voice-card">' +
        '<div class="voice-card-head"><span class="voice-index">' + idx + '</span><span class="voice-card-meta">' + esc(v.city) + '　｜　受付：' + formatMonth(v.month) + '</span></div>' +
        '<p class="voice-card-text">' + esc(v.text) + '</p>' +
        '<p class="voice-card-id">受付番号：' + esc(v.id) + '</p>' +
        link +
      '</div>';
  }

  function voiceCategoryBlock(catSlug){
    var c = categoryInfo(catSlug);
    if (!c) return '';
    var groups = groupByTheme(VOICES.items.filter(function(v){ return v.category===c.name; }));
    if (!groups.length) return '<p style="color:var(--muted);font-size:0.9rem;">このカテゴリのお悩みはまだ公開されていません。</p>';
    return groups.map(function(g){
      var cards = g.items.map(function(v,i){ return voiceCard(v, i+1); }).join('');
      return '<div class="theme-block"><h3 class="theme-title">' + esc(g.theme) + '</h3><div class="voice-card-grid">' + cards + '</div></div>';
    }).join('');
  }

  // ---------------------------------------------------------------
  // Pages
  // ---------------------------------------------------------------

  function renderTop(){
    var topVoices = VOICES.items.slice(0,3);
    var voiceCards = topVoices.map(function(v,i){ return voiceCard(v, i+1); }).join('');
    var voiceSection = topVoices.length
      ? '<div class="voice-card-grid">' + voiceCards + '</div>'
      : '<p style="color:var(--muted);font-size:0.9rem;">まだお悩みが登録されていません。</p>';

    var topCases = CASES.items.slice(0,3);
    var caseSection = topCases.length
      ? '<div class="card-grid">' + topCases.map(caseCard).join('') + '</div>'
      : '<p style="color:var(--muted);font-size:0.9rem;">解決事例は準備中です。動きがあり次第、ここに掲載します。</p>';

    var lineBtn = CONFIG.lineAddFriendUrl
      ? '<a href="' + esc(CONFIG.lineAddFriendUrl) + '" target="_blank" rel="noopener" class="btn btn-primary">💬 LINEで相談する</a>'
      : '<span class="btn btn-disabled" aria-disabled="true">💬 LINEで相談する（準備中）</span>';

    return '' +
    '<div class="hero">' +
      '<div class="wrap narrow">' +
        '<h1>' + segs(CONFIG.heroTitle || CONFIG.tagline) + '</h1>' +
        '<p class="lead">' + segs(CONFIG.heroLead || '') + '</p>' +
        '<div class="btn-row">' +
          lineBtn +
          '<a href="#/cases" class="btn btn-outline">解決事例を見る</a>' +
        '</div>' +
        '<p class="btn-note">いただいたお悩みは、個人が特定される情報を伏せた上で原文に近い形で公開しています。公開を望まれない場合は、その旨をお書きください（掲載しません）。</p>' +
      '</div>' +
    '</div>' +
    '<div class="wrap">' +
      '<section>' +
        '<div class="stat-grid">' +
          '<div class="stat-tile"><span class="stat-num">' + esc(STATS.total) + '</span><span class="stat-label">累計受付</span></div>' +
          '<div class="stat-tile"><span class="stat-num">' + esc(STATS.thisMonth) + '</span><span class="stat-label">今月の受付</span></div>' +
          '<div class="stat-tile"><span class="stat-num">' + esc(STATS.published) + '</span><span class="stat-label">公開中のお悩み</span></div>' +
        '</div>' +
      '</section>' +
      '<section>' +
        '<div class="section-head">' +
          '<h2 class="section-title">最近届いたお悩み</h2>' +
          '<p class="section-desc">個人が特定される情報を伏せた上で、原文に近い形で公開しています。</p>' +
        '</div>' +
        voiceSection +
        '<div class="btn-row" style="margin-top:16px;"><a href="#/voices" class="btn btn-outline">みんなのお悩みを見る</a></div>' +
      '</section>' +
      '<section>' +
        '<div class="section-head">' +
          '<h2 class="section-title">解決事例ピックアップ</h2>' +
          '<p class="section-desc">実際に動きがあり、解決に至った事例をご紹介します。</p>' +
        '</div>' +
        caseSection +
        '<div class="btn-row" style="margin-top:16px;"><a href="#/cases" class="btn btn-outline">解決事例を見る</a></div>' +
      '</section>' +
    '</div>';
  }

  function renderCases(){
    var body = CASES.items.length
      ? '<div class="card-grid">' + CASES.items.map(caseCard).join('') + '</div>'
      : '<p style="color:var(--muted);">現在公開している解決事例はありません。動きがあり次第、随時ここに掲載します。</p>';
    return '' +
    '<div class="wrap">' +
      '<section style="margin-top:36px;">' +
        '<div class="section-head">' +
          '<h1 class="section-title" style="font-size:1.6rem;">解決事例</h1>' +
          '<p class="section-desc">寄せられたお悩みのうち、実際に動きがあり、解決に至ったものをストーリーとしてご紹介します。数は多くありませんが、一件ずつ丁寧にお伝えします。</p>' +
        '</div>' +
        body +
      '</section>' +
    '</div>';
  }

  function renderVoices(activeSlug){
    var tabs = categoryTabs(activeSlug);
    var body;
    if (activeSlug){
      var c = categoryInfo(activeSlug);
      body = c ? voiceCategoryBlock(activeSlug) : '<p style="color:var(--muted);">該当するカテゴリはありません。</p>';
    } else {
      body = CATEGORIES.map(function(c){
        var block = voiceCategoryBlock(c.slug);
        var hasItems = VOICES.items.some(function(v){ return v.category===c.name; });
        if (!hasItems) return '';
        return '<div class="cat-block"><h2 class="cat-title">' + esc(c.name) + '</h2>' + block + '</div>';
      }).join('');
      if (!body) body = '<p style="color:var(--muted);">まだお悩みが登録されていません。</p>';
    }
    return '' +
    '<div class="wrap">' +
      '<section style="margin-top:36px;">' +
        '<div class="section-head">' +
          '<h1 class="section-title" style="font-size:1.6rem;">みんなのお悩み</h1>' +
          '<p class="section-desc">カテゴリで絞り込めます。テーマごとにまとめて掲載しています。件数は「数字で見る」でご覧いただけます。</p>' +
        '</div>' +
        '<div class="notice-box">掲載しているのは、いただいたお悩みを個人が特定される情報（お名前・番地・勤務先など）を伏せた上で、できるだけ原文に近い形にしたものです。誹謗中傷・特定の個人や団体への攻撃にあたるものは掲載していません（件数にも含めません）。</div>' +
        '<div class="tab-row" id="tabRow" data-prefix="voices">' + tabs + '</div>' +
        body +
      '</section>' +
    '</div>';
  }

  function storyBlock(b){
    if (b.type === 'img') {
      return '<figure class="story-image"><img src="' + esc(b.src) + '" alt="' + esc(b.alt||'') + '" loading="lazy">' +
        (b.caption ? '<figcaption>' + esc(b.caption) + '</figcaption>' : '') +
        '</figure>';
    }
    return '<p>' + esc(b.text) + '</p>';
  }

  function caseHeroHtml(c){
    if (!c.hero) return '';
    return '<figure class="case-hero"><img src="' + esc(c.hero) + '" alt="' + esc(c.heroAlt||'') + '" loading="lazy">' +
      (c.heroCaption ? '<figcaption>' + esc(c.heroCaption) + '</figcaption>' : '') +
      '</figure>';
  }

  function caseVideoHtml(c){
    if (!c.videoId) return '';
    var thumbUrl = 'https://i.ytimg.com/vi/' + encodeURIComponent(c.videoId) + '/hqdefault.jpg';
    var watchUrl = c.video || ('https://www.youtube.com/watch?v=' + c.videoId);
    var altText = c.videoCaption || c.title || '動画サムネイル';
    return '' +
    '<figure class="case-video">' +
      '<a href="' + esc(watchUrl) + '" target="_blank" rel="noopener" class="video-thumb-link" aria-label="YouTubeで動画を見る（新しいタブで開きます）">' +
        '<span class="video-thumb-wrap">' +
          '<img src="' + esc(thumbUrl) + '" alt="' + esc(altText) + '" loading="lazy" onerror="this.parentElement.classList.add(&#39;thumb-error&#39;)">' +
          '<span class="video-play-badge" aria-hidden="true">▶</span>' +
          '<span class="video-thumb-fallback">動画サムネイルを読み込めませんでした</span>' +
        '</span>' +
      '</a>' +
      '<figcaption>' +
        (c.videoCaption ? esc(c.videoCaption) + '　' : '') +
        '<a href="' + esc(watchUrl) + '" target="_blank" rel="noopener">YouTubeで見る</a>' +
      '</figcaption>' +
    '</figure>';
  }

  function renderCaseDetail(slug){
    var c = bySlug(slug);
    if (!c){
      return '<div class="wrap"><section style="margin-top:36px;"><p>事例が見つかりませんでした。まだ公開されていないか、下書きの段階です。</p><a href="#/cases" class="back-link">← 解決事例に戻る</a></section></div>';
    }
    var steps = (c.steps||[]).map(function(s,i){
      var bodyHtml = (s.blocks && s.blocks.length)
        ? s.blocks.map(storyBlock).join('')
        : '<p>' + esc(s.p) + '</p>';
      return '<div class="story-step"><div class="story-marker">' + (i+1) + '</div><div class="story-body"><h3>' + esc(s.h) + '</h3>' + bodyHtml + '</div></div>';
    }).join('');

    var relatedVoices = (c.receiptIds||[]).map(byVoiceId).filter(function(v){ return !!v; });
    var relatedHtml = '';
    if (relatedVoices.length){
      relatedHtml = '<div class="section-head" style="margin-top:34px;"><h2 class="section-title" style="font-size:1.1rem;">この事例に関係するお悩み</h2></div>' +
        relatedVoices.map(function(v){
          var slugForCat = categorySlugByName(v.category);
          return '<a class="related-voice-card" href="#/voices/' + esc(slugForCat||'') + '">' +
            '<div class="voice-card-meta">' + esc(v.city) + '　｜　受付：' + formatMonth(v.month) + '　｜　' + esc(v.id) + '</div>' +
            '<p class="voice-card-text" style="margin-top:4px;">' + esc(v.text) + '</p>' +
          '</a>';
        }).join('');
    }

    return '' +
    '<div class="wrap narrow">' +
      '<section style="margin-top:36px;">' +
        '<a href="#/cases" class="back-link">← 解決事例に戻る</a>' +
        '<div class="article-header">' +
          '<div class="chip-row">' + categoryChip(c.category) + '</div>' +
          '<h1>' + esc(c.title) + '</h1>' +
          '<div class="article-meta-row" style="color:var(--muted);font-size:0.86rem;">' + esc(c.city) + '　｜　受付：' + formatMonth(c.month) + '</div>' +
        '</div>' +
        caseHeroHtml(c) +
        caseVideoHtml(c) +
        '<div class="story-list">' + steps + '</div>' +
        '<p class="article-footnote">出典：' + esc(c.sources||'') + '</p>' +
        relatedHtml +
      '</section>' +
    '</div>';
  }

  function monthlyBarChart(){
    var rows = STATS.monthly || [];
    var months = rows.map(function(r){ return parseInt(r.month.split('-')[1],10) + '月'; });
    var values = rows.map(function(r){ return r.count; });
    var max = Math.max.apply(null, values.concat([1]));
    var w = 640, h = 220, padL = 30, padB = 30, padT = 20;
    var chartW = w - padL - 10;
    var chartH = h - padT - padB;
    var bw = values.length ? chartW / values.length : chartW;
    var bars = '';
    for (var i=0;i<values.length;i++){
      var bh = (values[i]/max) * chartH;
      var x = padL + i*bw + bw*0.2;
      var y = padT + (chartH - bh);
      var bwActual = bw*0.6;
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bwActual.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="#1a5fd0" rx="3"></rect>';
      bars += '<text x="' + (x + bwActual/2).toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle" font-size="12" fill="#0b2a5b" font-weight="700">' + values[i] + '</text>';
      bars += '<text x="' + (x + bwActual/2).toFixed(1) + '" y="' + (h - padB + 18).toFixed(1) + '" text-anchor="middle" font-size="12" fill="#5a6b85">' + months[i] + '</text>';
    }
    var axis = '<line x1="' + padL + '" y1="' + (padT+chartH) + '" x2="' + (w-10) + '" y2="' + (padT+chartH) + '" stroke="#d3e0f5" stroke-width="1"></line>';
    return '<svg class="bar-chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="月次受付件数の推移">' + axis + bars + '</svg>';
  }

  function horizBars(rows){
    var max = Math.max.apply(null, rows.map(function(r){ return r.v; }).concat([1]));
    return '<div class="stat-bars">' + rows.map(function(r){
      var pct = Math.round((r.v/max)*100);
      return '<div class="stat-bar-row"><span class="stat-bar-label">' + esc(r.k) + '</span>' +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="stat-bar-value">' + r.v + '件</span></div>';
    }).join('') + '</div>';
  }

  function renderStats(){
    var catRows = Object.keys(STATS.byCategory||{}).map(function(k){ return { k:k, v:STATS.byCategory[k] }; });
    var cityRows = Object.keys(STATS.byCity||{}).map(function(k){ return { k:k, v:STATS.byCity[k] }; });
    return '' +
    '<div class="wrap">' +
      '<section style="margin-top:36px;">' +
        '<div class="section-head">' +
          '<h1 class="section-title" style="font-size:1.6rem;">数字で見る藤田まこと</h1>' +
          '<p class="section-desc">件数のみを公開しています。解決率などの指標は掲載しません。</p>' +
        '</div>' +
        '<div class="chart-card">' +
          '<h3>月次推移（受付件数）</h3>' +
          monthlyBarChart() +
        '</div>' +
        '<div class="chart-card">' +
          '<h3>カテゴリ別内訳</h3>' +
          horizBars(catRows) +
        '</div>' +
        '<div class="chart-card">' +
          '<h3>市別内訳</h3>' +
          horizBars(cityRows) +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function renderPolicy(){
    return '' +
    '<div class="wrap narrow">' +
      '<section style="margin-top:36px;">' +
        '<div class="section-head">' +
          '<h1 class="section-title" style="font-size:1.6rem;">公開の考え方</h1>' +
          '<p class="section-desc">有権者のみなさんが政治に関わる方法をアップデートしたい——その思想にもとづく4つの原則です。</p>' +
        '</div>' +
        '<div class="layer-list">' +
          '<div class="layer-item">' +
            '<h3>① お悩みは、NG以外すべて公開します</h3>' +
            '<p>個人が特定される情報（お名前・番地・勤務先など）を伏せたうえで、できるだけ原文に近い形で公開します。NG＝誹謗中傷・特定の個人や団体への攻撃・クレーム的なもの・公序良俗に反するもの・営業目的のものに限り、件数にも含めません。</p>' +
          '</div>' +
          '<div class="layer-item">' +
            '<h3>② 件数も公開します</h3>' +
            '<p>月次・カテゴリ別・市別の件数を「数字で見る」でそのまま公開します。</p>' +
          '</div>' +
          '<div class="layer-item">' +
            '<h3>③ 解決したものは「解決事例」として紹介します</h3>' +
            '<p>解決率などの数字は出しません。実際に動きがあり解決に至ったものだけを、一件ずつストーリーでお伝えします。</p>' +
          '</div>' +
          '<div class="layer-item">' +
            '<h3>④ 公開を望まない方の意思を尊重します</h3>' +
            '<p>LINEで相談する際に公開の可能性をお知らせし、希望があれば掲載しません。公開を望まない方の内容は掲載せず、件数にのみ含めます。</p>' +
          '</div>' +
        '</div>' +
        '<p style="font-size:0.86rem;color:var(--muted);">訂正・削除のご希望は、LINEまたは事務所までご連絡ください。</p>' +
        '<div class="pledge-box">' +
          '<p>透明な政治を。有権者のみなさんが政治に関わる方法をアップデートしたい。</p>' +
        '</div>' +
      '</section>' +
    '</div>';
  }

  function renderMechanism(){
    var repoLink = CONFIG.repoUrl ? '<a href="' + esc(CONFIG.repoUrl) + '" target="_blank" rel="noopener">' + esc(CONFIG.repoUrl) + '</a>' : '（準備中）';
    return '' +
    '<div class="wrap narrow">' +
      '<section style="margin-top:36px;">' +
        '<div class="section-head">' +
          '<h1 class="section-title" style="font-size:1.6rem;">仕組み</h1>' +
          '<p class="section-desc">LINEでの相談から、このサイトでの公開までの流れです。</p>' +
        '</div>' +
        '<div class="flow-diagram">' +
          '<div class="flow-step">LINE<br>（相談を送る）</div>' +
          '<div class="flow-arrow">→</div>' +
          '<div class="flow-step">事務所<br>（NGの判定・個人情報を伏せる）</div>' +
          '<div class="flow-arrow">→</div>' +
          '<div class="flow-step">GitHub<br>（公開データを管理）</div>' +
          '<div class="flow-arrow">→</div>' +
          '<div class="flow-step">このサイト<br>（お悩み・件数・解決事例を掲載）</div>' +
        '</div>' +
        '<p style="font-size:0.94rem;">相談の受付・やりとりはすべてLINE上で完結します。事務所がNGにあたらないかを判定し、個人が特定される情報を伏せたうえで、GitHub（ソフトウェア開発でよく使われる情報公開の仕組み）で公開データを管理し、このサイトに「みんなのお悩み」「数字で見る」「解決事例」として表示しています。</p>' +
        '<div class="notice-box"><strong>オープンソースの考え方で運営しています（GitHubで管理）。</strong> 公開する情報の記録・更新履歴は誰でも確認できます。リポジトリ：' + repoLink + '</div>' +
        '<p style="font-size:0.86rem;color:var(--muted);">この仕組みは、2024〜2025年にチームみらい（安野たかひろ氏）がGitHubを用いた政策提案の透明化で示した知見を参考にしています。相談の受付そのものはLINEに一本化し、GitHubは「公開のための場所」として使う設計です。</p>' +
      '</section>' +
    '</div>';
  }

  function renderLoading(){
    return '<div class="wrap"><div class="state-box">読み込み中…</div></div>';
  }
  function renderError(){
    return '<div class="wrap"><div class="state-box">データの読み込みに失敗しました。しばらくしてから再度お試しください。</div></div>';
  }

  // ---------------------------------------------------------------
  // Header / footer / banner (config-driven)
  // ---------------------------------------------------------------

  function renderChrome(){
    var titleEl = document.getElementById('siteTitle');
    var taglineEl = document.getElementById('siteTagline');
    if (titleEl) titleEl.textContent = CONFIG.siteName;
    if (taglineEl) taglineEl.textContent = CONFIG.tagline;

    var footerOffice = document.getElementById('footerOffice');
    if (footerOffice){
      footerOffice.textContent = CONFIG.officeName || '';
      if (CONFIG.officeUrl) footerOffice.setAttribute('href', CONFIG.officeUrl);
    }
    var footerDistrict = document.getElementById('footerDistrict');
    if (footerDistrict) footerDistrict.textContent = CONFIG.district || '';

    var banner = document.getElementById('sampleBanner');
    if (banner){
      var isSample = !!(VOICES.sample || STATS.sample);
      banner.style.display = isSample ? 'block' : 'none';
      banner.textContent = '準備中：現在はサンプルデータを表示しています';
    }
  }

  function renderNav(){
    var hash = location.hash || '#/';
    var html = NAV.map(function(n){
      return '<a href="' + n.href + '"' + (n.match(hash) ? ' class="active"' : '') + '>' + n.label + '</a>';
    }).join('');
    var nav = document.getElementById('globalNav');
    if (nav) nav.innerHTML = html;
  }

  function bindTabRow(){
    var row = document.getElementById('tabRow');
    if (!row) return;
    var prefix = row.getAttribute('data-prefix') || 'voices';
    row.addEventListener('click', function(e){
      var btn = e.target.closest('.tab-btn');
      if (!btn) return;
      var slug = btn.getAttribute('data-slug');
      location.hash = slug ? '#/' + prefix + '/' + slug : '#/' + prefix;
    });
  }

  // ---------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------

  function route(){
    var app = document.getElementById('app');
    if (!app) return;

    if (DATA_ERROR){ app.innerHTML = renderError(); renderNav(); return; }
    if (!DATA_READY){ app.innerHTML = renderLoading(); renderNav(); return; }

    var hash = location.hash || '#/';
    var html;
    if (hash === '#/' || hash === ''){
      html = renderTop();
    } else if (hash === '#/voices'){
      html = renderVoices(null);
    } else if (hash.indexOf('#/voices/') === 0){
      html = renderVoices(hash.replace('#/voices/',''));
    } else if (hash === '#/cases'){
      html = renderCases();
    } else if (hash.indexOf('#/case/') === 0){
      html = renderCaseDetail(hash.replace('#/case/',''));
    } else if (hash === '#/stats'){
      html = renderStats();
    } else if (hash === '#/policy'){
      html = renderPolicy();
    } else if (hash === '#/mechanism'){
      html = renderMechanism();
    } else {
      html = renderTop();
    }
    app.innerHTML = html;
    renderNav();
    bindTabRow();
    window.scrollTo(0,0);
  }

  // ---------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------

  function fetchJson(path){
    var bust = 'v=' + Date.now();
    var url = path + (path.indexOf('?')===-1 ? '?' : '&') + bust;
    return fetch(url, { cache:'no-store' }).then(function(res){
      if (!res.ok) throw new Error('fetch failed: ' + path);
      return res.json();
    });
  }

  function loadData(){
    return Promise.all([
      fetchJson('config.json').then(function(d){ CONFIG = Object.assign({}, CONFIG, d); }),
      fetchJson('data/voices.json').then(function(d){ VOICES = d; }),
      fetchJson('data/stats.json').then(function(d){ STATS = d; }),
      fetchJson('data/cases.json').then(function(d){ CASES = d; })
    ]);
  }

  function init(){
    route(); // shows loading state immediately
    renderChrome();
    loadData().then(function(){
      DATA_READY = true;
      renderChrome();
      route();
    }).catch(function(err){
      DATA_ERROR = true;
      route();
      if (window.console) console.error(err);
    });
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', init);
})();
