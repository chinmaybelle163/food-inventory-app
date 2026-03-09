const FEISHU_APP_ID = 'cli_a9214bf1b439dbd6';
const FEISHU_APP_SECRET = 'xRgd9jmrU20PpFhE8pj4XeLPwexLJoC2';
const APP_TOKEN = 'LZAWbzMwOadjC2suQdCcsSYVnVb';
const FOOD_TABLE_ID = 'tbl4lftT71mfkG0c';
const WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/37f4a4a2-b5c6-4de0-abcb-3247c1a3525f';

async function getToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  });
  const data = await res.json();
  return data.tenant_access_token;
}

function toCST(date) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

async function sendToFeishu(text) {
  await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_type: 'text', content: { text } }),
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { items, notes } = body;

    const token = await getToken();

    const now = toCST(new Date());
    const dateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
    const dateDisplay = `${now.getUTCFullYear()}年${now.getUTCMonth()+1}月${now.getUTCDate()}日`;

    // 批量写入飞书
    const records = items.map(item => ({
      fields: {
        '食材名称': item.name,
        '分类': item.category,
        '库存状态': item.needBuy ? '需要购买' : '充足',
        '盘点日期': dateStr,
        '备注': '',
      }
    }));

    const batchRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${FOOD_TABLE_ID}/records/batch_create`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      }
    );
    const batchData = await batchRes.json();

    if (batchData.code !== 0) {
      return new Response(JSON.stringify({ ok: false, error: `飞书写入失败: ${batchData.msg}` }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 发购物清单
    const needBuyItems = items.filter(i => i.needBuy);
    if (needBuyItems.length > 0 || notes) {
      const groups = {};
      needBuyItems.forEach(item => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item.name);
      });

      let msg = `🛒 购物清单 ${dateDisplay}\n━━━━━━━━━━━━━━`;
      Object.entries(groups).forEach(([cat, names]) => {
        msg += `\n\n${cat}`;
        names.forEach(n => { msg += `\n  • ${n}`; });
      });
      if (notes) msg += `\n\n📝 其他补充\n  ${notes}`;
      msg += `\n\n━━━━━━━━━━━━━━\n共需购买 ${needBuyItems.length} 种食材${notes ? '，另有补充备注' : ''}`;

      await sendToFeishu(msg);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
