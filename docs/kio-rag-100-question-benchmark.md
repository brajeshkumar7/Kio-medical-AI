# KIO RAG Benchmark: 100 Grounded Questions

This benchmark is tailored to the source currently indexed by KIO: **The Gale Encyclopedia of Medicine, Second Edition, Volume 1 (A-B)**. It evaluates retrieval, evidence grounding, citation selection, typo handling, and answer clarity. It is not a benchmark for the full field of medicine.

## How to evaluate

For every question, the response passes when it:

1. Includes the expected evidence in equivalent wording.
2. Cites the listed PDF page for the key claim.
3. Does not transfer facts from a different condition.
4. Does not invent treatments, thresholds, prognosis, or warning signs not present in the cited excerpt.
5. Uses clear language; Markdown formatting may vary without affecting the result.

Suggested scoring per question: **2 points** for evidence, **1 point** for the correct citation, **1 point** for no unsupported claims, and **1 point** for clarity. Maximum score: **500**.

> Note: the encyclopedia was published in 2003. These definition questions test the RAG pipeline, not whether historical treatment guidance remains clinically current.

## Questions 1-20

| # | Test question | Expected evidence in the answer | Expected source |
|---:|---|---|---|
| 1 | What is an abscess? | An enclosed collection of liquefied tissue or pus caused by the body's defensive reaction to foreign material. | Gale, page 26 |
| 2 | What is acetaminophen used for? | A medicine used to relieve pain and reduce fever. | Gale, page 32 |
| 3 | What is achalasia? | A disorder of the esophagus that prevents normal swallowing. | Gale, page 34 |
| 4 | What is achondroplasia? | The most common cause of dwarfism or significantly abnormal short stature. | Gale, page 35 |
| 5 | What is acne? | A skin disease involving pimples when pores become clogged with oil, dead skin cells, and bacteria. | Gale, page 38 |
| 6 | What is an acoustic neuroma? | A benign tumor involving cells of the myelin sheath around the vestibulocochlear nerve. | Gale, page 41 |
| 7 | What are acromegaly and gigantism? | Disorders involving abnormal growth-hormone release and increased growth of bone and soft tissue; the answer should distinguish the terms if the retrieved text supports it. | Gale, page 46 |
| 8 | What is acute kidney failure? | Kidney damage temporarily prevents adequate waste/fluid removal or maintenance of kidney-regulated chemicals. | Gale, page 57 |
| 9 | What is acute stress disorder? | An anxiety disorder with dissociative and anxiety symptoms occurring within one month of trauma. | Gale, page 63 |
| 10 | What is Addison's disease? | Impaired adrenal cortex function causing reduced cortisol and aldosterone production. | Gale, page 67 |
| 11 | What are adenovirus infections? | DNA viruses that can cause upper respiratory infections, conjunctivitis, and other human infections. | Gale, page 70 |
| 12 | What is AIDS? | The advanced form of infection with HIV; an infectious disease caused by human immunodeficiency virus. | Gale, page 87 |
| 13 | What is albinism? | An inherited condition present at birth involving reduced or absent pigment in skin, hair, and eyes. | Gale, page 102 |
| 14 | What does the source mean by alcoholism? | A popular term covering alcohol abuse and alcohol dependence, involving repeated adverse life consequences. | Gale, page 109 |
| 15 | What is allergic rhinitis? | Hay fever: inflammation of nasal passages caused by an allergic reaction to airborne substances. | Gale, page 125 |
| 16 | What is an allergy? | An abnormal immune-system reaction to an otherwise harmless substance. | Gale, page 128 |
| 17 | What is alopecia? | Hair loss or baldness. | Gale, page 139 |
| 18 | What is ringworm? | A fungal infection of the skin, usually known as tinea corporis. | Gale, page 140 |
| 19 | What is altitude sickness? | A general term for a spectrum of disorders occurring at higher altitudes. | Gale, page 146 |
| 20 | What is Alzheimer's disease? | The most common form of dementia, involving cognitive decline severe enough to interfere with daily living. | Gale, page 148 |

## Questions 21-40

| # | Test question | Expected evidence in the answer | Expected source |
|---:|---|---|---|
| 21 | What is amebiasis? | An infection caused by the protozoan *Entamoeba histolytica* that can affect the intestines, liver, or other body parts. | Gale, page 157 |
| 22 | What is amenorrhea? | The absence of menstrual periods; the source distinguishes primary from secondary amenorrhea. | Gale, page 160 |
| 23 | What is amnesia? | Loss of memory, potentially involving damage to brain structures important for storage, processing, or recall. | Gale, page 165 |
| 24 | What is amyloidosis? | A progressive metabolic disease involving abnormal protein deposits in one or more organs or body systems. | Gale, page 175 |
| 25 | What is amyotrophic lateral sclerosis? | A neurodegenerative disease affecting nerves responsible for movement; also called motor neuron disease or Lou Gehrig's disease. | Gale, page 177 |
| 26 | What is an anaerobic infection? | An infection caused by bacteria that cannot grow in oxygen and may affect deep wounds, tissues, or organs. | Gale, page 181 |
| 27 | What is anal cancer? | An uncommon cancer affecting the anus, the terminal portion of the large intestine. | Gale, page 184 |
| 28 | What is anaphylaxis? | A rapidly progressing, life-threatening allergic reaction. | Gale, page 192 |
| 29 | What is anemia? | Abnormally low levels of healthy red blood cells or hemoglobin. | Gale, page 194 |
| 30 | What is angina? | Chest pain, discomfort, or pressure caused by insufficient blood supply to the heart muscle. | Gale, page 208 |
| 31 | How can an animal bite become infected? | Animal saliva can carry bacteria or other pathogens that enter the wound and multiply. | Gale, page 220 |
| 32 | What is ankylosing spondylitis? | Inflammation of the joints in the spine. | Gale, page 222 |
| 33 | What is anorexia nervosa? | An eating disorder involving fear of weight gain, self-starvation, and distorted body image. | Gale, page 225 |
| 34 | What is anosmia? | Loss or reduction of the sense of smell. | Gale, page 229 |
| 35 | What is anthrax? | A bacterial infection caused by *Bacillus anthracis* that primarily affects livestock but can spread to humans. | Gale, page 237 |
| 36 | What is antibiotic-associated colitis? | Intestinal inflammation that can occur after antibiotics and is caused by toxins from *Clostridium difficile*. | Gale, page 252 |
| 37 | What is anxiety? | A multisystem response to a perceived threat or danger involving bodily, personal-history, memory, and social factors. | Gale, page 331 |
| 38 | What is an aortic aneurysm? | Abnormal bulging or swelling in part of the aorta. | Gale, page 339 |
| 39 | What is aphasia? | Partial or total loss of spoken or written communication ability caused by brain injury or disease. | Gale, page 347 |
| 40 | What is aplastic anemia? | A disorder in which bone marrow greatly reduces or stops blood-cell production. | Gale, page 350 |

## Questions 41-60

| # | Test question | Expected evidence in the answer | Expected source |
|---:|---|---|---|
| 41 | What is appendicitis? | Inflammation of the appendix; untreated appendicitis may rupture and cause a potentially fatal infection. | Gale, page 355 |
| 42 | What is arbovirus encephalitis? | Brain inflammation caused by an arthropod-borne virus transmitted by organisms such as insects. | Gale, page 361 |
| 43 | What is an arrhythmia? | An abnormal heart rhythm that may be too fast, too slow, irregular, skipped, or include extra beats. | Gale, page 366 |
| 44 | What is an arterial embolism? | An embolus such as a clot, tissue, gas bubble, or foreign body travels in blood and becomes lodged in a vessel. | Gale, page 368 |
| 45 | What is an arteriovenous malformation? | A prenatal blood-vessel defect forming a tangled mass of arteries and veins without a normal capillary bed. | Gale, page 371 |
| 46 | What is asbestosis? | Chronic, progressive inflammation of the lung; it is not contagious. | Gale, page 383 |
| 47 | What is ascites? | Abnormal accumulation of fluid in the abdomen. | Gale, page 385 |
| 48 | What is aspergillosis? | Disease caused by *Aspergillus* fungi; the source describes multiple forms, including allergic bronchopulmonary aspergillosis. | Gale, page 389 |
| 49 | What is asthma? | A chronic inflammatory airway disease in which susceptible airways periodically narrow, producing wheezing and breathlessness. | Gale, page 393 |
| 50 | What is astigmatism? | Improper corneal focusing of an image onto the retina, producing blurred vision. | Gale, page 398 |
| 51 | What is ataxia-telangiectasia? | A rare genetic neurological disorder, also called Louis-Bar syndrome. | Gale, page 401 |
| 52 | What is atelectasis? | Collapse of part or all of one lung's tissue, interfering with normal oxygen absorption. | Gale, page 403 |
| 53 | What is atherosclerosis? | Buildup of waxy plaque inside blood vessels; it is a form of arteriosclerosis. | Gale, page 407 |
| 54 | What is athlete's foot? | A fungal infection between the toes causing itchy, sore, cracking, or peeling skin; also called tinea pedis. | Gale, page 412 |
| 55 | What is atopic dermatitis? | A non-contagious form of eczema involving chronically inflamed, itchy skin. | Gale, page 417 |
| 56 | How do atrial fibrillation and atrial flutter differ? | Both are abnormal atrial rhythms; fibrillation is chaotic and irregular, while flutter has regular atrial beats faster than the ventricles. | Gale, page 421 |
| 57 | What is an atrial septal defect? | An abnormal opening in the wall between the heart's left and right atria. | Gale, page 423 |
| 58 | What is autism according to the source? | A disorder of brain function involving social contact and language problems plus ritualistic or compulsive behavior and unusual environmental responses. | Gale, page 431 |
| 59 | What is an autoimmune disorder? | A condition in which the immune system attacks the body's own cells and damages tissue. | Gale, page 436 |
| 60 | What is babesiosis? | A red-blood-cell infection caused by the parasite *Babesia microti* and spread by tick bite. | Gale, page 447 |

## Questions 61-80

| # | Test question | Expected evidence in the answer | Expected source |
|---:|---|---|---|
| 61 | What is bacteremia? | Invasion of the bloodstream by bacteria. | Gale, page 449 |
| 62 | What is halitosis? | Halitosis is another name for unpleasant breath odor or bad breath. | Gale, page 451 |
| 63 | What is balanitis? | Inflammation of the head and foreskin of the penis. | Gale, page 453 |
| 64 | What is balantidiasis? | A digestive-tract infection caused by the protozoan *Balantidium coli*. | Gale, page 454 |
| 65 | What is a Bartholin's gland cyst? | A swollen, fluid-filled lump caused by blockage of a Bartholin's gland near the vaginal opening. | Gale, page 463 |
| 66 | What is bartonellosis? | A bacterial disease transmitted by sandflies, with acute and chronic forms, occurring in western South America. | Gale, page 465 |
| 67 | What is bed-wetting? | Involuntary urination during the night; the source also identifies enuresis as the technical term. | Gale, page 467 |
| 68 | What are bedsores? | Pressure sores that develop when skin over a weight-bearing area is compressed between bone and another hard surface. | Gale, page 470 |
| 69 | What is Bell's palsy? | Sudden unexplained weakness or paralysis of muscles on one side of the face. | Gale, page 475 |
| 70 | What is beriberi? | A thiamine or vitamin B1 deficiency disease affecting systems including muscles, heart, nerves, and digestion. | Gale, page 483 |
| 71 | What is berylliosis? | Lung inflammation caused by inhaling dust or fumes containing beryllium. | Gale, page 486 |
| 72 | What is bile duct cancer? | Cholangiocarcinoma: a malignant tumor of bile ducts within or outside the liver. | Gale, page 491 |
| 73 | What is biliary atresia? | Failure during fetal development to form an adequate route for bile drainage from liver to intestine. | Gale, page 493 |
| 74 | What is binge-eating disorder? | Loss of control with unusually large food intake over a short period, without regular compensatory purging behavior. | Gale, page 495 |
| 75 | What is bipolar disorder? | A mood disorder involving major swings between manic highs and depressive lows. | Gale, page 499 |
| 76 | What is a birth defect? | A physical abnormality present at birth, also called a congenital abnormality. | Gale, page 504 |
| 77 | What is bladder cancer? | Uncontrolled growth of cells lining the urinary bladder, forming a tumor. | Gale, page 520 |
| 78 | What are bladder stones? | Crystalline masses formed from minerals and proteins naturally present in urine. | Gale, page 524 |
| 79 | What is blastomycosis? | Infection caused by inhaled spores of *Blastomyces dermatitidis* that may involve lungs, skin, bones, or multiple systems. | Gale, page 526 |
| 80 | What are bleeding varices? | Bleeding, enlarged veins in the esophagus or upper stomach associated with liver disease. | Gale, page 529 |

## Questions 81-100

| # | Test question | Expected evidence in the answer | Expected source |
|---:|---|---|---|
| 81 | What are boils and carbuncles? | Bacterial infections around hair follicles; a carbuncle forms when multiple boils merge into a deep abscess. | Gale, page 550 |
| 82 | What is botulism? | Illness caused by botulinum toxin from *Clostridium* bacteria; the toxin blocks nerve signaling to muscles and can cause paralysis. | Gale, page 573 |
| 83 | What is a brain abscess? | A bacterial infection located within the brain. | Gale, page 580 |
| 84 | What is a brain tumor? | An abnormal growth of brain tissue; tumors may be benign or malignant and usually spread locally rather than outside the brain. | Gale, page 582 |
| 85 | What is breast cancer? | Malignant-cell development in breast tissue, commonly originating in the lining of milk glands or ducts. | Gale, page 591 |
| 86 | What is bronchiectasis? | Permanent abnormal widening of part of the bronchial tubes accompanied by infection. | Gale, page 610 |
| 87 | What is bronchitis? | Inflammation of the air passages between the nose and lungs, including the windpipe and bronchial tubes. | Gale, page 611 |
| 88 | What is brucellosis? | A bacterial disease caused by *Brucella*, primarily associated with livestock, with symptoms that may include intermittent fever, sweating, chills, and aches. | Gale, page 619 |
| 89 | What is a bruise? | Skin or mucous-membrane discoloration and tenderness caused by blood leaking from an injured vessel into tissue. | Gale, page 621 |
| 90 | What is bruxism? | Unconscious clenching and grinding of teeth, most often during sleep but sometimes during the day. | Gale, page 622 |
| 91 | What is Budd-Chiari syndrome? | A rare condition caused by clotting in veins draining the liver, which can enlarge the liver and produce ascites. | Gale, page 623 |
| 92 | What is Buerger's disease? | Inflammation of arteries, veins, and nerves, mainly in the legs, restricting blood flow; also called thromboangiitis obliterans. | Gale, page 625 |
| 93 | What is bulimia nervosa? | An eating disorder involving binge eating followed by attempts to purge or compensate through behaviors such as vomiting, fasting, excessive exercise, or laxatives. | Gale, page 625 |
| 94 | What is bundle branch block? | Disruption of the normal electrical-pulse pathway that drives the heartbeat. | Gale, page 627 |
| 95 | What is a bunion? | Abnormal enlargement and inflammation of the joint at the base of the big toe, often associated with chronic pressure. | Gale, page 628 |
| 96 | What is a burn? | Tissue injury caused by heat, friction, electricity, radiation, or chemicals. | Gale, page 630 |
| 97 | What is bursitis? | Painful inflammation of a bursa, a cushioning sac near joints where bones, tendons, and muscles move against one another. | Gale, page 634 |
| 98 | What is byssinosis? | Chronic asthma-like airway narrowing caused by inhaling cotton, flax, hemp, or jute particles; also called brown lung disease. | Gale, page 636 |
| 99 | What is a bone density test used for? | A scan used to check for osteoporosis or loss of bone strength. | Gale, page 554 |
| 100 | What is a blood culture? | A laboratory test for detecting and identifying microorganisms growing in blood when bloodstream infection is suspected. | Gale, page 536 |

## Result template

Use this table while testing:

| Question | Evidence (0-2) | Citation (0-1) | Grounding (0-1) | Clarity (0-1) | Total (0-5) | Notes |
|---:|---:|---:|---:|---:|---:|---|
| 1 |  |  |  |  |  |  |

Interpretation: **450-500** is excellent for this corpus, **400-449** is acceptable but needs review, **350-399** indicates recurring retrieval or grounding failures, and **below 350** requires pipeline investigation.
