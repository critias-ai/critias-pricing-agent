import importlib.util
import os
import sys
from pathlib import Path
import pytest
ROWS=int(os.environ.get('PRICING_SCALE_ROWS','0'))
@pytest.mark.skipif(not ROWS,reason='Opt-in: set PRICING_SCALE_ROWS=3000000 or 30000000')
def test_scaled_csv_reconciles_without_full_dataframe(tmp_path):
    path=Path(__file__).with_name('generate_scale.py');assert path.exists(),'scale generator missing'
    spec=importlib.util.spec_from_file_location('scale',path);module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    report=module.run_scale(tmp_path,ROWS)
    assert report['checked_rows']==ROWS and report['cache_reused']
    assert report['all_checks_passed']
