from flask import Flask, render_template, request, jsonify, send_file
import json
import os
import tempfile
from pathlib import Path
import uuid

app = Flask(__name__)

# Хранилище для схем и пользовательских компонентов
schemas = {}
custom_components = {}


# Загрузка стандартных библиотек KiCad
def load_kicad_libraries():
    libraries = {
        'basic': {
            'name': 'Basic Components',
            'components': {
                'resistor': {
                    'name': 'Resistor',
                    'reference': 'R',
                    'symbol': 'M 0,0 L 20,0 M 20,0 L 30,10 L 40,0 L 50,10 L 60,0 L 70,10 L 80,0 M 80,0 L 100,0',
                    'pins': [{'number': '1', 'x': 0, 'y': 0, 'name': '1'},
                             {'number': '2', 'x': 100, 'y': 0, 'name': '2'}],
                    'footprint': 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal',
                    'fields': {
                        'Value': '1k',
                        'Footprint': 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal',
                        'Datasheet': '~'
                    }
                },
                'capacitor': {
                    'name': 'Capacitor',
                    'reference': 'C',
                    'symbol': 'M 0,0 L 30,0 M 30,-15 L 30,15 M 30,0 L 70,0 M 70,-15 L 70,15 M 70,0 L 100,0',
                    'pins': [{'number': '1', 'x': 0, 'y': 0, 'name': '1'},
                             {'number': '2', 'x': 100, 'y': 0, 'name': '2'}],
                    'footprint': 'Capacitor_THT:C_Disc_D3.0mm_W1.6mm_P2.50mm',
                    'fields': {
                        'Value': '100nF',
                        'Footprint': 'Capacitor_THT:C_Disc_D3.0mm_W1.6mm_P2.50mm',
                        'Datasheet': '~'
                    }
                },
                'capacitor_polarized': {
                    'name': 'Polarized Capacitor',
                    'reference': 'C',
                    'symbol': 'M 0,0 L 30,0 M 30,-15 L 30,15 M 30,0 L 70,0 M 70,-15 L 70,15 M 70,0 L 100,0 M 85,-10 L 85,10 M 80,-5 L 90,5 M 80,5 L 90,-5',
                    'pins': [{'number': '1', 'x': 0, 'y': 0, 'name': '1'},
                             {'number': '2', 'x': 100, 'y': 0, 'name': '2'}],
                    'footprint': 'Capacitor_THT:CP_Radial_D5.0mm_P2.50mm',
                    'fields': {
                        'Value': '10uF',
                        'Footprint': 'Capacitor_THT:CP_Radial_D5.0mm_P2.50mm',
                        'Datasheet': '~'
                    }
                }
            }
        },
        'semiconductors': {
            'name': 'Semiconductors',
            'components': {
                'diode': {
                    'name': 'Diode',
                    'reference': 'D',
                    'symbol': 'M 0,50 L 30,50 M 30,20 L 30,80 M 30,50 L 70,50 L 70,20 L 30,80 L 70,50 M 70,50 L 100,50',
                    'pins': [{'number': '1', 'x': 0, 'y': 50, 'name': 'A'},
                             {'number': '2', 'x': 100, 'y': 50, 'name': 'K'}],
                    'footprint': 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal',
                    'fields': {
                        'Value': '1N4148',
                        'Footprint': 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal',
                        'Datasheet': '~'
                    }
                },
                'led': {
                    'name': 'LED',
                    'reference': 'D',
                    'symbol': 'M 0,50 L 30,50 M 30,20 L 30,80 M 30,50 L 70,50 L 70,20 L 30,80 L 70,50 M 70,50 L 100,50 M 50,30 L 50,70 M 45,35 L 55,65 M 55,35 L 45,65',
                    'pins': [{'number': '1', 'x': 0, 'y': 50, 'name': 'A'},
                             {'number': '2', 'x': 100, 'y': 50, 'name': 'K'}],
                    'footprint': 'LED_THT:LED_D5.0mm',
                    'fields': {
                        'Value': 'LED',
                        'Footprint': 'LED_THT:LED_D5.0mm',
                        'Datasheet': '~'
                    }
                },
                'transistor_npn': {
                    'name': 'NPN Transistor',
                    'reference': 'Q',

                    'symbol': 'M 50,0 L 50,30 M 50,30 L 30,60 M 50,30 L 70,60 M 50,0 L 50,10 M 30,60 L 30,100 M 70,60 L 70,100 M 50,10 L 50,30 M 45,15 L 55,15',
                    'pins': [
                        {'number': '1', 'x': 50, 'y': 0, 'name': 'E'},
                        {'number': '2', 'x': 30, 'y': 100, 'name': 'B'},
                        {'number': '3', 'x': 70, 'y': 100, 'name': 'C'}
                    ],
                    'footprint': 'Package_TO_SOT_THT:TO-92_Inline',
                    'fields': {
                        'Value': 'BC547',
                        'Footprint': 'Package_TO_SOT_THT:TO-92_Inline',
                        'Datasheet': '~'
                    }
                },
                'transistor_pnp': {
                    'name': 'PNP Transistor',
                    'reference': 'Q',
                    'symbol': 'M 50,0 L 50,30 M 50,30 L 30,60 M 50,30 L 70,60 M 50,0 L 50,10 M 30,60 L 30,100 M 70,60 L 70,100 M 50,10 L 50,30 M 50,15 L 50,25',
                    'pins': [
                        {'number': '1', 'x': 50, 'y': 0, 'name': 'E'},
                        {'number': '2', 'x': 30, 'y': 100, 'name': 'B'},
                        {'number': '3', 'x': 70, 'y': 100, 'name': 'C'}
                    ],
                    'footprint': 'Package_TO_SOT_THT:TO-92_Inline',
                    'fields': {
                        'Value': 'BC557',
                        'Footprint': 'Package_TO_SOT_THT:TO-92_Inline',
                        'Datasheet': '~'
                    }
                }
            }
        },
        'power': {
            'name': 'Power',
            'components': {
                'vcc': {
                    'name': 'VCC',
                    'reference': '#PWR',
                    'symbol': 'M 40,0 L 40,30 M 20,30 L 60,30 M 25,40 L 55,40 M 30,50 L 50,50 M 35,60',
                    'pins': [{'number': '1', 'x': 40, 'y': 0}],
                    'footprint': '',
                    'fields': {
                        'Value': 'VCC',
                        'Footprint': '',
                        'Datasheet': '~'
                    }
                },
                'gnd': {
                    'name': 'GND',
                    'reference': '#PWR',
                    'symbol': 'M 40,0 L 40,30 M 20,30 L 60,30 M 25,40 L 55,40 M 30,50 L 50,50 M 35,60 L 45,60',
                    'pins': [{'number': '1', 'x': 40, 'y': 0}],
                    'footprint': '',
                    'fields': {
                        'Value': 'GND',
                        'Footprint': '',
                        'Datasheet': '~'
                    }
                }
            }
        }
    }
    return libraries


kicad_libraries = load_kicad_libraries()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/save_schema', methods=['POST'])
def save_schema():
    data = request.json
    schema_id = data.get('id', 'default')
    schemas[schema_id] = data
    return jsonify({'status': 'success', 'id': schema_id})


@app.route('/api/load_schema/<schema_id>')
def load_schema(schema_id):
    schema = schemas.get(schema_id, {'components': [], 'wires': []})
    return jsonify(schema)


@app.route('/api/get_libraries')
def get_libraries():
    return jsonify({
        'kicad': kicad_libraries,
        'custom': custom_components
    })


@app.route('/api/save_component', methods=['POST'])
def save_component():
    data = request.json
    component_id = data.get('id', f"custom_{uuid.uuid4().hex[:8]}")

    # Удаляем id из данных компонента, чтобы он не сохранялся внутри
    component_data = data.copy()
    if 'id' in component_data:
        del component_data['id']

    custom_components[component_id] = component_data

    print(f"Saved custom component: {component_id}")  # Для отладки
    print(f"Custom components keys: {list(custom_components.keys())}")  # Для отладки

    return jsonify({'status': 'success', 'id': component_id})


@app.route('/api/delete_component/<component_id>')
def delete_component(component_id):
    if component_id in custom_components:
        del custom_components[component_id]
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Component not found'})


if __name__ == '__main__':
    app.run(debug=True)