ALTER TABLE `treatments` ADD `price_max` real;--> statement-breakpoint
ALTER TABLE `treatments` ADD `pricing_type` text DEFAULT 'Fixed' NOT NULL;
--> statement-breakpoint
UPDATE treatments SET name='Skin Consultation',price=2000,price_max=NULL,pricing_type='Fixed',description='Dermatology consultation.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('skin consultation','consultation','dermatology consultation');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-consultation','skinuvia','Skin Consultation','Dermatology consultation.',2000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('skin consultation','consultation','dermatology consultation'));

--> statement-breakpoint
UPDATE treatments SET name='Simple Hydra Facial',price=8000,price_max=NULL,pricing_type='Fixed',description='Deep cleansing and hydration.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('simple hydra facial','hydrafacial','hydra facial','simple hydrafacial');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-hydra-simple','skinuvia','Simple Hydra Facial','Deep cleansing and hydration.',8000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('simple hydra facial','hydrafacial','hydra facial','simple hydrafacial'));

--> statement-breakpoint
UPDATE treatments SET name='Advance Hydra Facial',price=10000,price_max=NULL,pricing_type='Fixed',description='Basic Hydra Facial plus photo facial.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('advance hydra facial','advanced hydra facial','advance hydrafacial');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-hydra-advance','skinuvia','Advance Hydra Facial','Basic Hydra Facial plus photo facial.',10000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('advance hydra facial','advanced hydra facial','advance hydrafacial'));

--> statement-breakpoint
UPDATE treatments SET name='Premium Hydra Facial',price=12000,price_max=NULL,pricing_type='Fixed',description='Advance Hydra Facial plus oxygen facial.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('premium hydra facial','premium hydrafacial');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-hydra-premium','skinuvia','Premium Hydra Facial','Advance Hydra Facial plus oxygen facial.',12000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('premium hydra facial','premium hydrafacial'));

--> statement-breakpoint
UPDATE treatments SET name='Laser Hair Removal — Face + Neck',price=4000,price_max=6000,pricing_type='Range',description='Face and neck laser hair removal; final charge within the published range.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — face + neck','laser hair removal (face)','laser hair reduction','laser hair removal - face + neck');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-laser-face','skinuvia','Laser Hair Removal — Face + Neck','Face and neck laser hair removal; final charge within the published range.',4000,6000,'Range',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — face + neck','laser hair removal (face)','laser hair reduction','laser hair removal - face + neck'));

--> statement-breakpoint
UPDATE treatments SET name='Laser Hair Removal — Underarms',price=6000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — underarms');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-laser-underarms','skinuvia','Laser Hair Removal — Underarms','',6000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — underarms'));

--> statement-breakpoint
UPDATE treatments SET name='Laser Hair Removal — Bikini Area',price=8000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — bikini area');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-laser-bikini','skinuvia','Laser Hair Removal — Bikini Area','',8000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — bikini area'));

--> statement-breakpoint
UPDATE treatments SET name='Laser Hair Removal — Full Arms',price=10000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — full arms');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-laser-arms','skinuvia','Laser Hair Removal — Full Arms','',10000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — full arms'));

--> statement-breakpoint
UPDATE treatments SET name='Laser Hair Removal — Half Legs',price=8000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — half legs');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-laser-half-legs','skinuvia','Laser Hair Removal — Half Legs','',8000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — half legs'));

--> statement-breakpoint
UPDATE treatments SET name='Laser Hair Removal — Full Legs',price=20000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — full legs');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-laser-legs','skinuvia','Laser Hair Removal — Full Legs','',20000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — full legs'));

--> statement-breakpoint
UPDATE treatments SET name='Laser Hair Removal — Full Body',price=35000,price_max=NULL,pricing_type='Fixed',description='Includes arms, legs, underarms and bikini area.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — full body');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-laser-body','skinuvia','Laser Hair Removal — Full Body','Includes arms, legs, underarms and bikini area.',35000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('laser hair removal — full body'));

--> statement-breakpoint
UPDATE treatments SET name='Photofacial',price=4000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('photofacial','photo facial');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-photofacial','skinuvia','Photofacial','',4000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('photofacial','photo facial'));

--> statement-breakpoint
UPDATE treatments SET name='Carbon Laser Facial',price=5000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('carbon laser facial');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-carbon','skinuvia','Carbon Laser Facial','',5000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('carbon laser facial'));

--> statement-breakpoint
UPDATE treatments SET name='PRP Therapy',price=10000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('prp therapy');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-prp','skinuvia','PRP Therapy','',10000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('prp therapy'));

--> statement-breakpoint
UPDATE treatments SET name='PRP + Microneedling',price=12000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('prp + microneedling');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-prp-micro','skinuvia','PRP + Microneedling','',12000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('prp + microneedling'));

--> statement-breakpoint
UPDATE treatments SET name='Microneedling',price=10000,price_max=15000,pricing_type='Range',description='Price depends on the serum or booster used.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('microneedling');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-microneedling','skinuvia','Microneedling','Price depends on the serum or booster used.',10000,15000,'Range',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('microneedling'));

--> statement-breakpoint
UPDATE treatments SET name='Botox — Upper Face (Korean)',price=25000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('botox — upper face (korean)','korean botox');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-botox-korean','skinuvia','Botox — Upper Face (Korean)','',25000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('botox — upper face (korean)','korean botox'));

--> statement-breakpoint
UPDATE treatments SET name='Botox — Upper Face (Allergan)',price=45000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('botox — upper face (allergan)','allergan botox');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-botox-allergan','skinuvia','Botox — Upper Face (Allergan)','',45000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('botox — upper face (allergan)','allergan botox'));

--> statement-breakpoint
UPDATE treatments SET name='Dermal Filler (1 ml)',price=35000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('dermal filler (1 ml)');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-filler','skinuvia','Dermal Filler (1 ml)','',35000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('dermal filler (1 ml)'));

--> statement-breakpoint
UPDATE treatments SET name='Skin Boosters',price=30000,price_max=NULL,pricing_type='Starting from',description='Starting price; final charge depends on the booster used.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('skin boosters');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-boosters','skinuvia','Skin Boosters','Starting price; final charge depends on the booster used.',30000,NULL,'Starting from',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('skin boosters'));

--> statement-breakpoint
UPDATE treatments SET name='HIFU',price=25000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('hifu');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-hifu','skinuvia','HIFU','',25000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('hifu'));

--> statement-breakpoint
UPDATE treatments SET name='Chemical Peels (Face)',price=8000,price_max=NULL,pricing_type='Fixed',description='',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('chemical peels (face)');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-peels','skinuvia','Chemical Peels (Face)','',8000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('chemical peels (face)'));

--> statement-breakpoint
UPDATE treatments SET name='Glow IV Drip',price=12000,price_max=NULL,pricing_type='Fixed',description='PKR 12,000 per session.',availability='6:00 pm to 10:00 pm',updated_at=CURRENT_TIMESTAMP WHERE clinic_id='skinuvia' AND lower(name) IN ('glow iv drip');
--> statement-breakpoint
INSERT INTO treatments(id,clinic_id,name,description,price,price_max,pricing_type,duration,assigned_doctors,availability,booking_instructions,status) SELECT 'SVC-glow-iv','skinuvia','Glow IV Drip','PKR 12,000 per session.',12000,NULL,'Fixed',0,'Dr. Aamina Iqbal','6:00 pm to 10:00 pm','Prices may vary depending on individual needs and consultation.','Active' WHERE NOT EXISTS(SELECT 1 FROM treatments WHERE clinic_id='skinuvia' AND lower(name) IN ('glow iv drip'));
