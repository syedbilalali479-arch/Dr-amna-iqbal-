UPDATE commerce_documents
SET body=json_set(
  body,
  '$.company_name',coalesce(nullif(json_extract(body,'$.company_name'),''),json_extract(body,'$.name')),
  '$.representative_name',coalesce(nullif(json_extract(body,'$.representative_name'),''),json_extract(body,'$.name')),
  '$.phone',coalesce(json_extract(body,'$.phone'),'')
)
WHERE clinic_id='skinuvia' AND kind='vendors';
