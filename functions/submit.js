export async function onRequestPost(context) {
  const { request, env } = context;

  const FEISHU_APP_ID = env.FEISHU_APP_ID;
  const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;

  try {
    // 获取 access token
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.tenant_access_token;

    // 转发请求体到飞书
    const body = await request.json();
    const { action, app_token, table_id, record_id, fields } = body;

    let feishuUrl;
    let feishuBody;
    let method = 'POST';

    if (action === 'add') {
      feishuUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records`;
      feishuBody = JSON.stringify({ fields });
    } else if (action === 'update') {
      feishuUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records/${record_id}`;
      feishuBody = JSON.stringify({ fields });
      method = 'PUT';
    } else if (action === 'list') {
      feishuUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records?${new URLSearchParams(fields)}`;
      feishuBody = undefined;
      method = 'GET';
    }

    const feishuRes = await fetch(feishuUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: feishuBody
    });

    const data = await feishuRes.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
