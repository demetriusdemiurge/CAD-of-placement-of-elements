{
  "name": "Standard SMD Library",
  "version": "1.0",
  "description": "Стандартная библиотека SMD корпусов",
  "footprints": [
    {
      "id": "fp-R0603",
      "name": "R_0603",
      "description": "Резистор SMD 0603",
      "pads": [
        {"id": "pad-1", "number": "1", "position": {"x": -0.8, "y": 0}, "width": 0.8, "height": 0.8, "shape": "rect", "layer": "top"},
        {"id": "pad-2", "number": "2", "position": {"x": 0.8, "y": 0}, "width": 0.8, "height": 0.8, "shape": "rect", "layer": "top"}
      ],
      "outline": [{"x": -0.8, "y": -0.4}, {"x": 0.8, "y": -0.4}, {"x": 0.8, "y": 0.4}, {"x": -0.8, "y": 0.4}],
      "courtyard": [{"x": -1.05, "y": -0.65}, {"x": 1.05, "y": -0.65}, {"x": 1.05, "y": 0.65}, {"x": -1.05, "y": 0.65}],
      "width": 1.6,
      "height": 0.8
    },
    {
      "id": "fp-R0805",
      "name": "R_0805",
      "description": "Резистор SMD 0805",
      "pads": [
        {"id": "pad-1", "number": "1", "position": {"x": -1.0, "y": 0}, "width": 1.0, "height": 1.25, "shape": "rect", "layer": "top"},
        {"id": "pad-2", "number": "2", "position": {"x": 1.0, "y": 0}, "width": 1.0, "height": 1.25, "shape": "rect", "layer": "top"}
      ],
      "outline": [{"x": -1.0, "y": -0.625}, {"x": 1.0, "y": -0.625}, {"x": 1.0, "y": 0.625}, {"x": -1.0, "y": 0.625}],
      "courtyard": [{"x": -1.25, "y": -0.875}, {"x": 1.25, "y": -0.875}, {"x": 1.25, "y": 0.875}, {"x": -1.25, "y": 0.875}],
      "width": 2.0,
      "height": 1.25
    },
    {
      "id": "fp-R1206",
      "name": "R_1206",
      "description": "Резистор SMD 1206",
      "pads": [
        {"id": "pad-1", "number": "1", "position": {"x": -1.6, "y": 0}, "width": 1.0, "height": 1.6, "shape": "rect", "layer": "top"},
        {"id": "pad-2", "number": "2", "position": {"x": 1.6, "y": 0}, "width": 1.0, "height": 1.6, "shape": "rect", "layer": "top"}
      ],
      "outline": [{"x": -1.6, "y": -0.8}, {"x": 1.6, "y": -0.8}, {"x": 1.6, "y": 0.8}, {"x": -1.6, "y": 0.8}],
      "courtyard": [{"x": -1.85, "y": -1.05}, {"x": 1.85, "y": -1.05}, {"x": 1.85, "y": 1.05}, {"x": -1.85, "y": 1.05}],
      "width": 3.2,
      "height": 1.6
    },
    {
      "id": "fp-C0805",
      "name": "C_0805",
      "description": "Конденсатор SMD 0805",
      "pads": [
        {"id": "pad-1", "number": "1", "position": {"x": -1.0, "y": 0}, "width": 1.0, "height": 1.25, "shape": "rect", "layer": "top"},
        {"id": "pad-2", "number": "2", "position": {"x": 1.0, "y": 0}, "width": 1.0, "height": 1.25, "shape": "rect", "layer": "top"}
      ],
      "outline": [{"x": -1.0, "y": -0.625}, {"x": 1.0, "y": -0.625}, {"x": 1.0, "y": 0.625}, {"x": -1.0, "y": 0.625}],
      "courtyard": [{"x": -1.25, "y": -0.875}, {"x": 1.25, "y": -0.875}, {"x": 1.25, "y": 0.875}, {"x": -1.25, "y": 0.875}],
      "width": 2.0,
      "height": 1.25
    },
    {
      "id": "fp-SOT23",
      "name": "SOT-23",
      "description": "Корпус SOT-23 для транзисторов",
      "pads": [
        {"id": "pad-1", "number": "1", "position": {"x": -0.95, "y": 1.0}, "width": 0.6, "height": 0.7, "shape": "rect", "layer": "top"},
        {"id": "pad-2", "number": "2", "position": {"x": 0.95, "y": 1.0}, "width": 0.6, "height": 0.7, "shape": "rect", "layer": "top"},
        {"id": "pad-3", "number": "3", "position": {"x": 0, "y": -1.0}, "width": 0.6, "height": 0.7, "shape": "rect", "layer": "top"}
      ],
      "outline": [{"x": -1.4, "y": -0.65}, {"x": 1.4, "y": -0.65}, {"x": 1.4, "y": 0.65}, {"x": -1.4, "y": 0.65}],
      "courtyard": [{"x": -1.65, "y": -1.5}, {"x": 1.65, "y": -1.5}, {"x": 1.65, "y": 1.5}, {"x": -1.65, "y": 1.5}],
      "width": 2.8,
      "height": 3.0
    },
    {
      "id": "fp-SOIC8",
      "name": "SOIC-8",
      "description": "Корпус SOIC-8 SMD",
      "pads": [
        {"id": "pad-1", "number": "1", "position": {"x": -2.7, "y": -1.905}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"},
        {"id": "pad-2", "number": "2", "position": {"x": -2.7, "y": -0.635}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"},
        {"id": "pad-3", "number": "3", "position": {"x": -2.7, "y": 0.635}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"},
        {"id": "pad-4", "number": "4", "position": {"x": -2.7, "y": 1.905}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"},
        {"id": "pad-5", "number": "5", "position": {"x": 2.7, "y": 1.905}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"},
        {"id": "pad-6", "number": "6", "position": {"x": 2.7, "y": 0.635}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"},
        {"id": "pad-7", "number": "7", "position": {"x": 2.7, "y": -0.635}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"},
        {"id": "pad-8", "number": "8", "position": {"x": 2.7, "y": -1.905}, "width": 0.6, "height": 1.5, "shape": "rect", "layer": "top"}
      ],
      "outline": [{"x": -2.5, "y": -2.5}, {"x": 2.5, "y": -2.5}, {"x": 2.5, "y": 2.5}, {"x": -2.5, "y": 2.5}],
      "courtyard": [{"x": -3.5, "y": -2.75}, {"x": 3.5, "y": -2.75}, {"x": 3.5, "y": 2.75}, {"x": -3.5, "y": 2.75}],
      "width": 7.0,
      "height": 5.0
    }
  ],
  "createdAt": "2025-12-16T00:00:00.000Z",
  "modifiedAt": "2025-12-16T00:00:00.000Z"
}
