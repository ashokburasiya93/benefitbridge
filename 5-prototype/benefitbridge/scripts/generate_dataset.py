"""Generate the BenefitBridge synthetic dataset.

Everything here is fictional: the Republic of Aurelia, its Social Support Agency,
its schemes and every person. Amounts are in Aurelian dollars ($).

Outputs (in ../data):
  schemes.json      12 benefit schemes with numbered clauses
  citizens.json     household records as held by the agency (deliberately imperfect)
  events.json       life events arriving today, with unstructured source text
  history.json      last year's life events and whether/when people claimed (baseline)
  ground_truth.json expected facts and entitlements per event (eval labels only,
                    never shown to the app's AI)

Ground truth is computed by an independent Python implementation of the scheme
rules over the "true" post-event household, so the TypeScript engine in the app
is checked against something it did not produce.
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(20261020)
TODAY = date(2026, 10, 20)
OUT = Path(__file__).resolve().parent.parent / "data"
OUT.mkdir(exist_ok=True)

# ---------------------------------------------------------------- schemes
SCHEMES = [
    {"id": "CB", "name": "Child Benefit", "type": "monthly", "means_tested": False, "discretionary": False,
     "summary": "$95 a month for each child under 16.",
     "clauses": {
         "CB-1": "A household is eligible for each child under the age of 16 who lives in the household.",
         "CB-2": "The payment is $95 per eligible child per month.",
         "CB-3": "Child Benefit is not means-tested."},
     "documents": ["Child's birth registration number"]},
    {"id": "NMG", "name": "New Mother and Baby Grant", "type": "one-off", "means_tested": True, "discretionary": False,
     "summary": "$600 one-off payment for a new baby, household income under $45,000.",
     "clauses": {
         "NMG-1": "A household is eligible where a child was born within the last 90 days.",
         "NMG-2": "Annual household income must be below $45,000.",
         "NMG-3": "The grant is a one-off payment of $600 per child born."},
     "documents": ["Child's birth registration number", "Proof of household income"]},
    {"id": "JSA", "name": "Jobseeker Allowance", "type": "monthly", "means_tested": True, "discretionary": False,
     "summary": "$1,150 a month for up to 9 months for people aged 18 to 65 who lost work.",
     "clauses": {
         "JSA-1": "The applicant must be aged 18 to 65 and currently unemployed.",
         "JSA-2": "The applicant's employment must have ended within the last 12 months.",
         "JSA-3": "Annual household income from all other sources must be below $40,000.",
         "JSA-4": "Savings must be below $15,000.",
         "JSA-5": "The payment is $1,150 per month for up to 9 months."},
     "documents": ["Employer separation notice", "Bank statement showing savings"]},
    {"id": "HSB", "name": "Housing Support Benefit", "type": "monthly", "means_tested": True, "discretionary": False,
     "summary": "Up to $400 a month for private renters paying over 30% of income in rent.",
     "clauses": {
         "HSB-1": "The household must rent its home privately (social housing tenants are not eligible).",
         "HSB-2": "Annual household income must be below $40,000.",
         "HSB-3": "Annual rent must be more than 30% of annual household income.",
         "HSB-4": "The payment is the monthly rent above 30% of monthly income, capped at $400 per month."},
     "documents": ["Tenancy agreement", "Proof of household income"]},
    {"id": "CAR", "name": "Carer Allowance", "type": "monthly", "means_tested": False, "discretionary": False,
     "summary": "$320 a month for people giving 20+ hours of care a week.",
     "clauses": {
         "CAR-1": "The applicant must provide at least 20 hours of care per week to a person with a disability or long-term illness.",
         "CAR-2": "The payment is $320 per month."},
     "documents": ["Statement from the cared-for person's doctor"]},
    {"id": "DSP", "name": "Disability Support Payment", "type": "monthly", "means_tested": False, "discretionary": True,
     "summary": "$1,250 a month; needs a medical assessment by an assessor.",
     "clauses": {
         "DSP-1": "The applicant must be unable to work 15 or more hours a week for at least 6 months because of a disability or illness.",
         "DSP-2": "Eligibility is decided only after an independent medical assessment.",
         "DSP-3": "The payment is $1,250 per month."},
     "documents": ["Medical evidence", "Assessment appointment"]},
    {"id": "AGP", "name": "Age Pension", "type": "monthly", "means_tested": True, "discretionary": False,
     "summary": "$1,050 a month from age 66, income under $30,000 single or $45,000 couple.",
     "clauses": {
         "AGP-1": "The applicant must be aged 66 or over.",
         "AGP-2": "Annual household income must be below $30,000 for a single person or $45,000 for a couple.",
         "AGP-3": "The payment is $1,050 per month."},
     "documents": ["Proof of age", "Proof of household income"]},
    {"id": "BSP", "name": "Bereavement Support Payment", "type": "mixed", "means_tested": False, "discretionary": False,
     "summary": "$2,500 one-off, plus $350 a month for 12 months with children under 16.",
     "clauses": {
         "BSP-1": "The applicant's spouse or partner must have died within the last 12 months.",
         "BSP-2": "The applicant must be under 66.",
         "BSP-3": "A one-off payment of $2,500 is made.",
         "BSP-4": "Where the applicant has a child under 16, an additional $350 per month is paid for 12 months."},
     "documents": ["Death registration number"]},
    {"id": "ESA", "name": "Winter Energy Assistance", "type": "annual", "means_tested": True, "discretionary": False,
     "summary": "$250 a year for low-income households or people on JSA, DSP or Age Pension.",
     "clauses": {
         "ESA-1": "A household is eligible if annual household income is below $28,000.",
         "ESA-2": "A household is also eligible if anyone in it receives or is eligible for Jobseeker Allowance or Age Pension.",
         "ESA-3": "The payment is $250 per year."},
     "documents": []},
    {"id": "SCH", "name": "School Meals and Uniform Support", "type": "annual", "means_tested": True, "discretionary": False,
     "summary": "$300 a year per child aged 5 to 17, income under $35,000.",
     "clauses": {
         "SCH-1": "A household is eligible for each child aged 5 to 17.",
         "SCH-2": "Annual household income must be below $35,000.",
         "SCH-3": "The payment is $300 per eligible child per year."},
     "documents": ["School enrolment confirmation"]},
    {"id": "CCS", "name": "Childcare Subsidy", "type": "monthly", "means_tested": True, "discretionary": False,
     "summary": "60% of childcare fees for children under 6 where all adults work, income under $90,000.",
     "clauses": {
         "CCS-1": "A household is eligible where it has a child under 6.",
         "CCS-2": "Every adult in the household must be employed.",
         "CCS-3": "Annual household income must be below $90,000.",
         "CCS-4": "The subsidy is 60% of monthly childcare fees, capped at $900 per month."},
     "documents": ["Childcare provider invoice"]},
    {"id": "EHG", "name": "Emergency Hardship Grant", "type": "one-off", "means_tested": True, "discretionary": True,
     "summary": "Discretionary one-off help in a crisis; a caseworker decides.",
     "clauses": {
         "EHG-1": "A caseworker may award up to $1,000 where a household faces an immediate crisis such as eviction, utilities being cut off or no money for food.",
         "EHG-2": "Awards are at the caseworker's discretion and are never automatic."},
     "documents": ["Caseworker assessment"]},
]

# ---------------------------------------------------------------- people
FIRST = ["Amara", "Liam", "Sofia", "Mateo", "Aisha", "Noah", "Mei", "Arjun", "Fatima", "Lukas", "Chloe", "Diego",
         "Priya", "Omar", "Hana", "Tomasz", "Grace", "Kwame", "Elena", "Ravi", "Zainab", "Jack", "Lucia", "Minh",
         "Ingrid", "Samuel", "Leila", "Marco", "Yuki", "Daniel", "Nadia", "Felix", "Rosa", "Ibrahim", "Anna", "Tariq",
         "Maya", "Pavel", "Esther", "Kofi", "Isabel", "Hamza", "Clara", "Joon", "Aroha", "Sipho", "Vera", "Ahmed"]
LAST = ["Okafor", "Novak", "Haddad", "Silva", "Kowalski", "Nguyen", "Patel", "Mensah", "Rossi", "Kim", "Fischer",
        "Garcia", "Ahmed", "Tanaka", "Murphy", "Dubois", "Singh", "Ivanova", "Lopez", "Chen", "Walker", "Moreau",
        "Hussain", "Brown", "Petrov", "Santos", "Larsen", "Mbeki", "Costa", "Reid", "Yilmaz", "Hall", "Torres", "Ali"]
LANGS = ["English"] * 10 + ["Spanish"] * 2 + ["Arabic"] * 2 + ["Vietnamese", "Polish", "Hindi", "Mandarin"]
REGIONS = ["Northport", "Eastvale", "Riverside", "Highmoor", "Southbay", "Westfield"]
used_names = set()


def name():
    while True:
        n = f"{random.choice(FIRST)} {random.choice(LAST)}"
        if n not in used_names:
            used_names.add(n)
            return n


def dob_for_age(age, jitter_days=300):
    return TODAY - timedelta(days=int(age * 365.25) + random.randint(0, jitter_days))


def age_on(dob, on=TODAY):
    return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))


def iso(d):
    return d.isoformat() if d else None


citizens = []


def make_citizen(age=None, partnered=None, kids=None, employment=None, income=None, savings=None, tenure=None,
                 rent=None, enrolled=None, lang=None, consent=True, kid_ages=None, take_up=0.8):
    cid = f"C-{1001 + len(citizens)}"
    age = age if age is not None else random.randint(22, 70)
    partnered = partnered if partnered is not None else random.random() < 0.55
    if kid_ages is None:
        nk = kids if kids is not None else (random.choice([0, 0, 1, 1, 2, 3]) if age < 55 else 0)
        kid_ages = [random.randint(0, 17) for _ in range(nk)]
    surname = None
    full = name()
    surname = full.split()[1]
    children = [{"name": f"{random.choice(FIRST)} {surname}", "dob": iso(dob_for_age(a))} for a in kid_ages]
    employment = employment or ("retired" if age >= 66 else random.choice(["employed"] * 7 + ["unemployed", "student"]))
    if income is None and random.random() > 0.12:
        income = random.choice([18000, 22000, 26000, 31000, 36000, 42000, 48000, 55000, 64000, 78000, 95000])
    elif income == "missing":
        income = None
    tenure = tenure or random.choice(["rent", "rent", "own", "social"])
    if tenure == "rent" and rent is None:
        rent = random.choice([850, 950, 1050, 1150, 1250, 1400])
    c = {
        "id": cid,
        "full_name": full,
        "dob": iso(dob_for_age(age)),
        "preferred_language": lang or random.choice(LANGS),
        "region": random.choice(REGIONS),
        "contact": {"phone": f"+00 555 {random.randint(1000, 9999)} {random.randint(100, 999)}",
                    "email": f"{full.lower().replace(' ', '.')}@example.org"},
        "partner": ({"name": f"{random.choice(FIRST)} {surname}", "dob": iso(dob_for_age(age + random.randint(-4, 4))),
                     "status": "partnered", "employment_status": random.choice(["employed", "employed", "unemployed"])}
                    if partnered else None),
        "children": children,
        "employment_status": employment,
        "job_end_date": None,
        "household_income_annual": income,
        "savings": savings if savings is not None else (random.choice([None, 1200, 3500, 8000, 14000, 22000])),
        "tenure": tenure,
        "rent_monthly": rent if tenure == "rent" else None,
        "disability_unable_to_work": False,
        "care_hours_weekly": 0,
        "partner_care_hours_weekly": 0,
        "childcare_fees_monthly": None,
        "enrolled": enrolled if enrolled is not None else [],
        "consent_proactive_contact": consent,
        "record_updated": iso(TODAY - timedelta(days=random.randint(30, 900))),
    }
    citizens.append(c)
    # people already claim some of what they're entitled to, but not all (the take-up gap)
    if enrolled is None:
        c["enrolled"] = [s for s in py_eligibility(c)["eligible"] if random.random() < take_up]
    return c


# ----------------------------------------------- independent rules (Python)
def py_eligibility(h):
    """Independent implementation used only for ground truth labels."""
    out = {"eligible": [], "needs_info": [], "route": []}
    age = age_on(date.fromisoformat(h["dob"]))
    kids = [age_on(date.fromisoformat(k["dob"])) for k in h["children"]]
    kid_days = [(TODAY - date.fromisoformat(k["dob"])).days for k in h["children"]]
    inc = h["household_income_annual"]
    partner = h["partner"] if h["partner"] and h["partner"]["status"] == "partnered" else None
    enrolled = set(h["enrolled"])

    def add(sid, bucket):
        if sid not in enrolled:
            out[bucket].append(sid)

    if any(a < 16 for a in kids):
        add("CB", "eligible")
    if any(d <= 90 for d in kid_days):
        if inc is None:
            add("NMG", "needs_info")
        elif inc < 45000:
            add("NMG", "eligible")
    jsa_ok = False
    if h["employment_status"] == "unemployed" and 18 <= age <= 65 and h["job_end_date"] \
            and (TODAY - date.fromisoformat(h["job_end_date"])).days <= 365:
        if inc is None or h["savings"] is None:
            add("JSA", "needs_info")
        elif inc < 40000 and h["savings"] < 15000:
            add("JSA", "eligible")
            jsa_ok = True
    if h["tenure"] == "rent" and h["rent_monthly"]:
        if inc is None:
            add("HSB", "needs_info")
        elif inc < 40000 and h["rent_monthly"] * 12 > 0.3 * inc:
            add("HSB", "eligible")
    if (h["care_hours_weekly"] or 0) >= 20 or (h.get("partner_care_hours_weekly") or 0) >= 20:
        add("CAR", "eligible")
    if h["disability_unable_to_work"]:
        add("DSP", "route")
    agp_ok = False
    if age >= 66:
        limit = 45000 if partner else 30000
        if inc is None:
            add("AGP", "needs_info")
        elif inc < limit:
            add("AGP", "eligible")
            agp_ok = True
    if h["partner"] and h["partner"]["status"] == "widowed" and age < 66:
        dd = h["partner"].get("death_date")
        if dd and (TODAY - date.fromisoformat(dd)).days <= 365:
            add("BSP", "eligible")
    if (inc is not None and inc < 28000) or jsa_ok or agp_ok or "JSA" in enrolled or "AGP" in enrolled:
        add("ESA", "eligible")
    elif inc is None:
        add("ESA", "needs_info")
    if any(5 <= a <= 17 for a in kids):
        if inc is None:
            add("SCH", "needs_info")
        elif inc < 35000:
            add("SCH", "eligible")
    if any(a < 6 for a in kids):
        adults_employed = h["employment_status"] == "employed" and (not partner or partner["employment_status"] == "employed")
        if adults_employed:
            if inc is None or h["childcare_fees_monthly"] is None:
                add("CCS", "needs_info")
            elif inc < 90000:
                add("CCS", "eligible")
    if h.get("_hardship"):
        add("EHG", "route")
    return out


# ------------------------------------------------------- background population
for _ in range(100):
    make_citizen(take_up=0.55)

# duplicate record (data quality issue): same person entered twice
dup_src = citizens[7]
dup = json.loads(json.dumps(dup_src))
dup["id"] = f"C-{1001 + len(citizens)}"
dup["contact"]["phone"] = f"+00 555 {random.randint(1000, 9999)} {random.randint(100, 999)}"
dup["record_updated"] = iso(TODAY - timedelta(days=1400))
dup["enrolled"] = []
citizens.append(dup)


# ------------------------------------------------------------- life events
events, truth = [], []


def money(n):
    return f"${n:,.0f}"


def long_date(d):
    return f"{d.day} {d.strftime('%B')} {d.year}"


def add_event(c, etype, source, text, changes, facts, hardship=False, registry_facts=None, edate=None):
    """changes: dict applied to the household to get the true post-event state.
    facts: list of (field, value) the text states and the extractor should find."""
    eid = f"E-{2001 + len(events)}"
    edate = edate or (TODAY - timedelta(days=random.randint(0, 4)))
    events.append({"id": eid, "citizen_id": c["id"], "type": etype, "received": iso(edate), "source": source,
                   "text": text, "registry_facts": registry_facts or {}})
    true_h = json.loads(json.dumps(c))
    for k, v in changes.items():
        if k == "partner":
            true_h["partner"] = v
        elif k == "add_child":
            true_h["children"].append(v)
        else:
            true_h[k] = v
    true_h["_hardship"] = hardship
    exp = py_eligibility(true_h)
    truth.append({"event_id": eid, "expected_facts": [{"field": f, "value": v} for f, v in facts], **exp})


def birth(c, days_ago, note_variant):
    dob = TODAY - timedelta(days=days_ago)
    child = {"name": f"Baby {c['full_name'].split()[1]}", "dob": iso(dob)}
    text = (f"BIRTHS REGISTRY NOTIFICATION\nRegistration no. BR-{random.randint(100000, 999999)}\n"
            f"Child: {child['name']}\nDate of birth: {long_date(dob)}\nParent: {c['full_name']} ({c['id']})\n")
    facts = []
    if note_variant == "income":
        inc = c["household_income_annual"]
        text += (f"\nHealth visitor note: Mum is on unpaid leave until spring. Household now living on partner's wages, "
                 f"around {money(inc)} a year. Asked whether there is any help with nappies and formula.")
        facts.append(("household_income_annual", inc))
    add_event(c, "birth", "Births Registry", text, {"add_child": child}, facts,
              registry_facts={"new_child_dob": iso(dob), "new_child_name": child["name"]})


def job_loss(c, end_days_ago, income_after, savings, phrasing):
    end = TODAY - timedelta(days=end_days_ago)
    employer = random.choice(["Harbour Logistics", "Northport Metals", "Bright Retail Group", "Eastvale Call Centre",
                              "Riverside Foods", "Aurelia Print Co."])
    if phrasing == 0:
        text = (f"EMPLOYER SEPARATION NOTICE\nEmployer: {employer}\nEmployee: {c['full_name']}\n"
                f"Last day of employment: {long_date(end)}\nReason: redundancy (site closure)\n")
        facts = [("employment_status", "unemployed"), ("job_end_date", iso(end))]
        if income_after is not None:
            text += f"\nCaseworker phone note: says the household income is now about {money(income_after)} a year from the partner's part-time job. Savings of roughly {money(savings)}."
            facts += [("household_income_annual", income_after), ("savings", savings)]
    else:
        text = (f"Citizen web message from {c['full_name']}:\n\"Hi, my contract at {employer} ended on {long_date(end)} "
                f"and I haven't found anything yet. ")
        facts = [("employment_status", "unemployed"), ("job_end_date", iso(end))]
        if income_after is not None:
            text += f"We're down to {money(income_after)} a year coming in now. I have about {money(savings)} saved. "
            facts += [("household_income_annual", income_after), ("savings", savings)]
        text += "Is there anything I can apply for? I don't really know how the system works.\""
    add_event(c, "job_loss", "Employer Separation Notice" if phrasing == 0 else "Citizen Web Message", text,
              {"employment_status": "unemployed", "job_end_date": iso(end),
               "household_income_annual": income_after if income_after is not None else c["household_income_annual"],
               "savings": savings if income_after is not None else c["savings"]}, facts)


def bereavement(c, days_ago, income_after):
    dd = TODAY - timedelta(days=days_ago)
    p = dict(c["partner"])
    p["status"] = "widowed"
    p["death_date"] = iso(dd)
    text = (f"DEATH REGISTRY NOTIFICATION\nDeceased: {c['partner']['name']}\nDate of death: {long_date(dd)}\n"
            f"Surviving spouse/partner on record: {c['full_name']} ({c['id']})\n")
    facts = [("partner_status", "widowed"), ("partner_death_date", iso(dd))]
    changes = {"partner": p}
    if income_after is not None:
        text += f"\nFuneral director's referral: family says they have lost the main income; household now has about {money(income_after)} a year."
        facts.append(("household_income_annual", income_after))
        changes["household_income_annual"] = income_after
    add_event(c, "bereavement", "Death Registry", text, changes, facts,
              registry_facts={"partner_death_date": iso(dd)})


def disability(c, carer_partner_hours):
    text = (f"HOSPITAL DISCHARGE SUMMARY (shared with consent)\nPatient: {c['full_name']} ({c['id']})\n"
            f"Discharged after a stroke. Patient will be unable to work for at least 6 months and needs help with daily tasks. ")
    facts = [("disability_unable_to_work", True)]
    changes = {"disability_unable_to_work": True, "employment_status": "unemployed"}
    if carer_partner_hours:
        text += f"Partner {c['partner']['name']} will be caring for them around {carer_partner_hours} hours a week."
        facts.append(("partner_care_hours_weekly", carer_partner_hours))
        changes["partner_care_hours_weekly"] = carer_partner_hours
    add_event(c, "disability", "Hospital Discharge Summary", text, changes, facts)


def turning_66(c):
    text = (f"POPULATION REGISTER: AGE MILESTONE\n{c['full_name']} ({c['id']}) reached age 66 this month.\n"
            f"No Age Pension claim on file.")
    add_event(c, "age_milestone", "Population Register", text, {}, [])


def rent_rise(c, new_rent, hardship, lang="English"):
    if lang == "Spanish":
        text = (f"Mensaje web de {c['full_name']}:\n\"Hola, el casero nos ha subido el alquiler a {money(new_rent)} al mes "
                f"y ya no podemos pagarlo. ")
        if hardship:
            text += "Nos han dado un aviso de desalojo para el mes que viene. "
        text += "¿Hay alguna ayuda?\""
        facts = [("rent_monthly", new_rent), ("tenure", "rent")]
    else:
        text = (f"Caseworker phone note, {c['full_name']}:\nCalled in upset. Landlord has raised the rent to {money(new_rent)} a month "
                f"from next month. ")
        if hardship:
            text += "Already behind and has received an eviction notice. Electricity was cut off last week. "
        text += "Asked if anything can help."
        facts = [("rent_monthly", new_rent), ("tenure", "rent")]
    if hardship:
        facts.append(("hardship_flag", True))
    add_event(c, "housing_cost", "Citizen Web Message" if lang == "Spanish" else "Caseworker Phone Note", text,
              {"rent_monthly": new_rent, "tenure": "rent"}, facts, hardship=hardship)


def separation(c, income_after):
    text = (f"Citizen web message from {c['full_name']}:\n\"My partner moved out last month and I'm on my own with the kids now. "
            f"It's just my income, about {money(income_after)} a year. I work full time. Childcare costs me "
            f"{money(c.get('_fees', 700))} a month and I'm struggling.\"")
    p = dict(c["partner"])
    p["status"] = "separated"
    facts = [("partner_status", "separated"), ("household_income_annual", income_after),
             ("employment_status", "employed"), ("childcare_fees_monthly", c.get('_fees', 700))]
    add_event(c, "separation", "Citizen Web Message", text,
              {"partner": p, "household_income_annual": income_after, "employment_status": "employed",
               "childcare_fees_monthly": c.get('_fees', 700)}, facts)


def care_start(c, hours):
    text = (f"Caseworker phone note, {c['full_name']}:\nHas given up some shifts to look after their elderly father, who has dementia. "
            f"Says she is now caring for him about {hours} hours a week.")
    add_event(c, "caring", "Caseworker Phone Note", text, {"care_hours_weekly": hours}, [("care_hours_weekly", hours)])


# -- build 40 events against purpose-made households
for i in range(6):  # births
    inc = random.choice([24000, 31000, 38000, 52000, 41000, 70000])
    c = make_citizen(age=random.randint(24, 38), partnered=True, kid_ages=random.choice([[], [3], [7]]),
                     income=inc, tenure=random.choice(["rent", "own"]))
    birth(c, random.randint(2, 20), "income" if i % 2 == 0 else "none")
for i in range(8):  # job loss
    c = make_citizen(age=random.randint(25, 60), employment="employed", income=random.choice([52000, 61000, 47000]),
                     kid_ages=random.choice([[], [9], [4, 11]]), tenure=random.choice(["rent", "own", "rent"]),
                     savings=random.choice([2000, 6000, 18000]))
    inc_after = None if i in (3, 6) else random.choice([0, 14000, 22000, 33000, 45000])
    sav = random.choice([1500, 4000, 9000, 21000])
    job_loss(c, random.randint(5, 40), inc_after, sav, i % 2)
for i in range(5):  # bereavement
    c = make_citizen(age=random.choice([38, 45, 52, 61, 69]), partnered=True,
                     kid_ages=random.choice([[], [8], [12, 15]]), income=random.choice([30000, 58000, 72000]))
    bereavement(c, random.randint(3, 25), random.choice([None, 19000, 26000]))
for i in range(4):  # disability
    c = make_citizen(age=random.randint(40, 62), partnered=i != 2, employment="employed",
                     income=random.choice([26000, 39000, 50000]))
    disability(c, random.choice([25, 35, 40]) if c["partner"] else 0)
for i in range(5):  # turning 66
    c = make_citizen(age=66, partnered=random.random() < 0.5, kid_ages=[], employment="retired",
                     income=[21000, 28000, "missing", 41000, 52000][i], tenure=random.choice(["own", "rent", "social"]), take_up=0)
    turning_66(c)
for i in range(6):  # housing cost
    c = make_citizen(age=random.randint(23, 58), tenure="rent", rent=950, income=random.choice([19000, 27000, 33000, 44000]),
                     kid_ages=random.choice([[], [6], [2, 10]]), lang="Spanish" if i in (1, 4) else None)
    rent_rise(c, random.choice([1150, 1250, 1350]), hardship=i in (0, 4), lang="Spanish" if i in (1, 4) else "English")
for i in range(3):  # separation
    c = make_citizen(age=random.randint(28, 42), partnered=True, kid_ages=random.choice([[2, 6], [4], [1, 9]]),
                     employment="employed", income=72000, tenure="rent")
    c["partner"]["employment_status"] = "employed"
    c["_fees"] = random.choice([650, 800, 950])
    separation(c, random.choice([31000, 38000, 46000]))
    del c["_fees"]
for i in range(3):  # caring
    c = make_citizen(age=random.randint(35, 58), employment="employed", income=random.choice([29000, 41000]))
    care_start(c, random.choice([22, 30, 15]))

# one person who opted out of proactive contact (guardrail test)
citizens[-5]["consent_proactive_contact"] = False

# ------------------------------------------------------------- history (baseline)
history = []
etypes = ["birth", "job_loss", "bereavement", "disability", "age_milestone", "housing_cost", "separation", "caring"]
for i in range(320):
    et = random.choice(etypes)
    d = date(2025, 7, 1) + timedelta(days=random.randint(0, 360))
    entitled = random.randint(1, 4)
    r = random.random()
    if r < 0.21:
        claimed_after = random.randint(3, 30)
    elif r < 0.55:
        claimed_after = random.randint(31, 200)
    else:
        claimed_after = None
    # claimed only some of what they were entitled to
    claimed_n = 0 if claimed_after is None else random.randint(1, entitled)
    history.append({"event_type": et, "event_date": iso(d), "schemes_entitled": entitled,
                    "schemes_claimed": claimed_n, "days_to_first_claim": claimed_after,
                    "annual_value_entitled": entitled * random.choice([1200, 2400, 3800, 6000, 9000])})

for c in citizens:
    c.pop("_hardship", None)
json.dump(SCHEMES, open(OUT / "schemes.json", "w"), indent=2)
json.dump(citizens, open(OUT / "citizens.json", "w"), indent=2, ensure_ascii=False)
json.dump(events, open(OUT / "events.json", "w"), indent=2, ensure_ascii=False)
json.dump(truth, open(OUT / "ground_truth.json", "w"), indent=2)
json.dump(history, open(OUT / "history.json", "w"), indent=2)
print(len(citizens), "citizens,", len(events), "events,", len(history), "history rows")
