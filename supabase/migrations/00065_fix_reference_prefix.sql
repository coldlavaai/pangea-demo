-- Update operative reference number generator to use CL- prefix
CREATE OR REPLACE FUNCTION generate_operative_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL THEN
    NEW.reference_number := 'CL-' || LPAD(nextval('operative_ref_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
