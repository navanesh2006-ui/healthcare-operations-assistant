import io
import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_discharge_plan_pdf(patient_data: dict, tasks: list) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    # Custom CareBridge dark teal / green styling
    primary_color = colors.HexColor("#0B1F22")
    accent_green = colors.HexColor("#4CAF50")
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=accent_green,
        spaceAfter=10
    )
    normal_style = styles['Normal']
    normal_style.fontSize = 10
    normal_style.leading = 13

    bold_style = ParagraphStyle('BoldStyle', parent=normal_style, fontName='Helvetica-Bold')

    story = []

    # Hospital & App Banner
    story.append(Paragraph("<b>CareBridge: Agentic Hospital Discharge & Follow-up Coordinator</b>", header_style))
    story.append(Paragraph(f"<b>Discharging Hospital:</b> {patient_data.get('hospital_name', 'General Hospital')}", bold_style))
    story.append(Paragraph(f"<b>Patient Name:</b> {patient_data.get('name')} | <b>Age/Gender:</b> {patient_data.get('age')}/{patient_data.get('gender')} | <b>Patient ID:</b> {patient_data.get('patient_code')}", normal_style))
    story.append(Paragraph(f"<b>Date:</b> {datetime.date.today().strftime('%B %d, %Y')} | <b>District:</b> {patient_data.get('district')}", normal_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=2, color=accent_green, spaceAfter=15))

    # Disclaimer Note
    story.append(Paragraph("<i>Note: This discharge coordinator chart synthesizes medical instructions for follow-up coordination. For clinical emergencies, call emergency services immediately.</i>", normal_style))
    story.append(Spacer(1, 15))

    # Tasks Table
    table_data = [
        [
            Paragraph("<b>Category</b>", bold_style),
            Paragraph("<b>Instruction & Schedule</b>", bold_style),
            Paragraph("<b>Plain-Language Guide</b>", bold_style),
            Paragraph("<b>Status</b>", bold_style)
        ]
    ]

    for t in tasks:
        table_data.append([
            Paragraph(t.get('category', 'General').replace('_', ' ').title(), normal_style),
            Paragraph(t.get('instruction_text', ''), normal_style),
            Paragraph(t.get('simple_text', ''), normal_style),
            Paragraph(t.get('status', 'Pending'), bold_style)
        ])

    t_table = Table(table_data, colWidths=[90, 180, 200, 70])
    t_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#12302B")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(t_table)
    story.append(Spacer(1, 20))
    story.append(Paragraph("<b>Emergency Warning Signs:</b> If you experience severe shortness of breath, chest pressure, fever, or bleeding, contact emergency medical services or visit the nearest emergency room immediately.", ParagraphStyle('WarnStyle', parent=normal_style, textColor=colors.HexColor("#DC2626"), fontName='Helvetica-Bold')))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

def generate_analysis_report_pdf(report: dict, hospital_name: str = "General Hospital") -> bytes:
    """
    Generates a PDF for the 6-Section Clinical Discharge Analysis Report.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    accent_green = colors.HexColor("#2E7D32")
    header_style = ParagraphStyle('RHeader', parent=styles['Heading1'], fontSize=18, textColor=accent_green, spaceAfter=8)
    sub_head = ParagraphStyle('RSub', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor("#1B5E20"), spaceBefore=10, spaceAfter=4)
    normal_style = ParagraphStyle('RNorm', parent=styles['Normal'], fontSize=9.5, leading=13)
    bold_style = ParagraphStyle('RBold', parent=normal_style, fontName='Helvetica-Bold')
    evid_style = ParagraphStyle('REvid', parent=normal_style, textColor=colors.HexColor("#15803D"), fontName='Helvetica-Oblique')
    warn_style = ParagraphStyle('RWarn', parent=normal_style, textColor=colors.HexColor("#B91C1C"), fontName='Helvetica-Bold')

    story = []

    # Title & Banner
    story.append(Paragraph("<b>CareBridge: 5-Agent Discharge Extraction & Analysis Report</b>", header_style))
    story.append(Paragraph(f"<b>Hospital:</b> {hospital_name} | <b>Generated Date:</b> {datetime.date.today().strftime('%B %d, %Y')}", normal_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=accent_green, spaceAfter=10))

    # Safety Banner
    banner_text = "<b>Safety Disclaimer:</b> This analysis organizes what is written in the discharge summary. It does not diagnose or recommend treatment. Clinical staff must confirm everything."
    banner_table = Table([[Paragraph(banner_text, ParagraphStyle('BanStyle', parent=normal_style, textColor=colors.HexColor("#854D0E")))]], colWidths=[540])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF9C3")),
        ('BORDER', (0,0), (-1,-1), 1, colors.HexColor("#EAB308")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 12))

    # Section A: Patient Details
    sec_a = report.get("section_a", {})
    story.append(Paragraph("Section A: Connected Patient Details", sub_head))
    a_data = [
        [Paragraph(f"<b>Patient Name:</b> {sec_a.get('patient_name')}", normal_style), Paragraph(f"<b>Patient ID:</b> {sec_a.get('patient_id')}", normal_style)],
        [Paragraph(f"<b>Age / Gender:</b> {sec_a.get('age')}y / {sec_a.get('gender')}", normal_style), Paragraph(f"<b>Admission Date:</b> {sec_a.get('admission_date')}", normal_style)],
        [Paragraph(f"<b>Discharge Date:</b> {sec_a.get('discharge_date')}", normal_style), Paragraph(f"<b>Treating Doctor / Dept:</b> {sec_a.get('treating_doctor_dept')}", normal_style)]
    ]
    a_table = Table(a_data, colWidths=[270, 270])
    a_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(a_table)
    story.append(Spacer(1, 10))

    # Section B: Problem / Diagnosis as Written
    sec_b = report.get("section_b", {})
    story.append(Paragraph("Section B: Problem / Diagnosis as Written", sub_head))
    story.append(Paragraph(f"<b>Verbatim Diagnosis:</b> {sec_b.get('diagnosis_verbatim')}", bold_style))
    story.append(Paragraph(f"<b>Plain-Language Explanation:</b> {sec_b.get('explanation_en')}", normal_style))
    story.append(Paragraph(f"<i>Evidence:</i> {sec_b.get('evidence_sentence')} | <i>Status:</i> {sec_b.get('status')}", evid_style))
    story.append(Spacer(1, 10))

    # Section C: Why Admitted
    sec_c = report.get("section_c", {})
    story.append(Paragraph("Section C: Why the Patient Was Admitted", sub_head))
    story.append(Paragraph(sec_c.get('reason_summary_en', ''), normal_style))
    story.append(Paragraph(f"<i>Evidence:</i> {sec_c.get('evidence_sentence')}", evid_style))
    story.append(Spacer(1, 10))

    # Section D: Medicines to Continue
    sec_d = report.get("section_d", {})
    story.append(Paragraph("Section D: Medicines to Continue", sub_head))
    meds = sec_d.get("medicines", [])
    if meds:
        d_data = [[Paragraph("<b>Prescribed Medication & Dosage</b>", bold_style), Paragraph("<b>Status / Review Note</b>", bold_style)]]
        for m in meds:
            inst = m.get("instruction_text", "")
            stat = m.get("status", "Auto-extracted")
            note = f" (Note: {m.get('reviewer_notes')})" if m.get("reviewer_notes") else ""
            d_data.append([Paragraph(inst, normal_style), Paragraph(f"<b>{stat}</b>{note}", normal_style)])
        d_table = Table(d_data, colWidths=[360, 180])
        d_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(d_table)
    story.append(Spacer(1, 10))

    # Section E: Follow-up Chart Process
    sec_e = report.get("section_e", {})
    story.append(Paragraph("Section E: Follow-up Chart Process (Timeline)", sub_head))
    steps = sec_e.get("steps", [])
    if steps:
        e_data = [[Paragraph("<b>Due Date</b>", bold_style), Paragraph("<b>Title & Category</b>", bold_style), Paragraph("<b>Plain-Language Guide</b>", bold_style)]]
        for idx, s in enumerate(steps):
            e_data.append([
                Paragraph(s.get("due_date", "TBD"), normal_style),
                Paragraph(f"<b>Step {idx+1}:</b> {s.get('title')}", normal_style),
                Paragraph(s.get("simple_text", ""), normal_style)
            ])
        e_table = Table(e_data, colWidths=[90, 200, 250])
        e_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(e_table)
    story.append(Spacer(1, 10))

    # Section F: Warning Signs
    sec_f = report.get("section_f", {})
    story.append(Paragraph("Section F: Warning Signs & Emergency Contacts", sub_head))
    story.append(Paragraph(sec_f.get('warning_text_en', ''), warn_style))
    story.append(Spacer(1, 10))

    # Missing items
    not_found = report.get("not_found_in_summary", [])
    if not_found:
        story.append(Paragraph("Not Found in Summary:", sub_head))
        for nf in not_found:
            story.append(Paragraph(f"• <b>{nf.get('field')}:</b> {nf.get('reason')}", normal_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
