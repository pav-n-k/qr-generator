import { useState } from 'react';
import {
    Container,
    Card,
    Form,
    Button,
    Alert,
    Spinner,
    Row,
    Col,
} from 'react-bootstrap';
import QRCode from 'qrcode';
import JSZip from 'jszip';

const PREFIX_OPTIONS = [
    { value: 'DSR', label: 'Dock seat rear' },
    { value: 'TSR', label: 'Tablet Seat rear' },
    { value: 'TSN', label: 'Tablet Seat rear without battery' },
    { value: 'DCR', label: 'Dock Console Rear' },
    { value: 'TCR', label: 'Tablet Console Rear' },
    { value: 'TCN', label: 'Tablet console rear without battery' },
    { value: 'DCF', label: 'Display Central Front' },
];

// Жёсткая привязка P/N к выбранному S/N Prefix
const PN_BY_PREFIX = {
    DCF: '412300-7900210-00-011-0-02',
    TCR: '412300-7900212-00-011-0-01',
    TCN: '412300-7900212-10-011-0-01',
    DCR: '412300-7900213-00-011-0-01',
    DSR: '412300-7900225-00-011-0-01',
    TSR: '412300-7900224-00-011-0-01',
    TSN: '412300-7900224-10-011-0-01',
};

const DEFAULT_PREFIX = 'TCR'; // Оставляем выбранным первый вариант

// Сегодняшняя дата в формате YYYY-MM-DD (нужен для <input type="date">)
const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Начальные значения формы (P/N — по DEFAULT_PREFIX, дата — сегодняшняя).
// Оформлено функцией, чтобы дата всегда была актуальной (в т.ч. после "Clear")
const getInitialFormData = () => ({
    pn: PN_BY_PREFIX[DEFAULT_PREFIX],
    hw: '',
    date: getTodayDateString(),
    prefix: DEFAULT_PREFIX,
    startNumber: '',
    totalCodes: '',
});

function App() {
    const [formData, setFormData] = useState(getInitialFormData);
    const [pnEditable, setPnEditable] = useState(false); // P/N редактируется только по кнопке-карандашу
    const [generatedFiles, setGeneratedFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'prefix') {
            // При смене S/N Prefix жёстко подставляем соответствующий P/N
            // и снова блокируем поле для ручного редактирования
            setFormData((prev) => ({
                ...prev,
                prefix: value,
                pn: PN_BY_PREFIX[value] ?? '',
            }));
            setPnEditable(false);
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }

        setError('');
    };

    // Функция для полной очистки формы
    const handleClear = () => {
        setFormData(getInitialFormData());
        setPnEditable(false);
        setGeneratedFiles([]);
        setError('');
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError('');
        setGeneratedFiles([]);

        try {
            const { pn, hw, date, prefix, startNumber, totalCodes } = formData;

            // Валидация
            if (!pn.trim()) throw new Error('Введите P/N.');
            if (!hw.trim()) throw new Error('Введите H/W.');
            if (!date) throw new Error('Выберите дату.');

            const startNum = parseInt(startNumber, 10);
            const count = parseInt(totalCodes, 10);

            if (isNaN(startNum)) throw new Error('Enter the starting number.');
            if (isNaN(count)) throw new Error('Enter the number of QR codes.');
            if (count <= 0)
                throw new Error('The number of codes must be greater than 0.');

            const zip = new JSZip();
            const filesData = [];
            const baseData = `P/N: ${pn}\nH/W: ${hw}\nДата: ${date}`;

            for (let i = 0; i < count; i++) {
                const currentSn = startNum + i;
                const snString = `${prefix}${String(currentSn).padStart(6, '0')}`;
                const fullData = `${baseData}\nS/N: ${snString}`;
                const filename = `QR_${snString}.png`;

                const qrBase64 = await QRCode.toDataURL(fullData, {
                    width: 100,
                    margin: 1,
                    color: { dark: '#000000', light: '#ffffff' },
                });

                const response = await fetch(qrBase64);
                const blob = await response.blob();

                filesData.push({
                    blob,
                    name: filename,
                    info: `P/N: ${pn}\nH/W: ${hw}\nДата: ${date}\nS/N: ${snString}`,
                });

                zip.file(filename, blob);
            }

            const displayedFiles = filesData.map((f) => ({
                url: URL.createObjectURL(f.blob),
                name: f.name,
                info: f.info,
            }));
            setGeneratedFiles(displayedFiles);

            if (count === 1) {
                const link = document.createElement('a');
                link.href = displayedFiles[0].url;
                link.download = displayedFiles[0].name;
                link.click();
            } else {
                const firstSn = `${prefix}${String(startNum).padStart(6, '0')}`;
                const lastSn = `${prefix}${String(startNum + count - 1).padStart(6, '0')}`;
                const zipName = `${firstSn}-${lastSn}.zip`;

                zip.generateAsync({ type: 'blob' }).then((content) => {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(content);
                    link.download = zipName;
                    link.click();
                });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className='py-5'>
            <div className='text-center mb-5'>
                <h1 className='display-4 fw-bold mb-3'>QR Generator</h1>
                <p className='text-muted lead'>Fill in the form fields: </p>
            </div>

            <Card className='p-4 mb-5'>
                <Form>
                    <Row className='g-3'>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>P/N</Form.Label>
                                <div className='d-flex align-items-center gap-2'>
                                    <Form.Control
                                        name='pn'
                                        value={formData.pn}
                                        onChange={handleChange}
                                        placeholder='412300-7900212-00-011-0-01'
                                        readOnly={!pnEditable}
                                        className={
                                            !pnEditable ? 'pn-locked' : ''
                                        }
                                    />
                                    <Button
                                        variant='outline-light'
                                        size='sm'
                                        className='flex-shrink-0'
                                        onClick={() =>
                                            setPnEditable((prev) => !prev)
                                        }
                                        title={
                                            pnEditable
                                                ? 'Заблокировать P/N'
                                                : 'Редактировать P/N вручную'
                                        }
                                    >
                                        <i className='bi bi-pencil'></i>
                                    </Button>
                                </div>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>H/W</Form.Label>
                                <Form.Control
                                    name='hw'
                                    value={formData.hw}
                                    onChange={handleChange}
                                    placeholder='3.0'
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>Date</Form.Label>
                                <Form.Control
                                    type='date'
                                    name='date'
                                    value={formData.date}
                                    onChange={handleChange}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>S/N Prefix</Form.Label>
                                <Form.Select
                                    name='prefix'
                                    value={formData.prefix}
                                    onChange={handleChange}
                                >
                                    {PREFIX_OPTIONS.map((opt) => (
                                        <option
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.value} - {opt.label}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>S/N number</Form.Label>
                                <Form.Control
                                    type='number'
                                    name='startNumber'
                                    value={formData.startNumber}
                                    onChange={handleChange}
                                    placeholder='100'
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>Number of QR codes</Form.Label>
                                <Form.Control
                                    type='number'
                                    name='totalCodes'
                                    value={formData.totalCodes}
                                    onChange={handleChange}
                                    placeholder='20'
                                    min='1'
                                    max='100'
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <div className='d-flex justify-content-end gap-3 mt-4'>
                        <Button
                            variant='outline-danger'
                            onClick={handleClear}
                            disabled={loading}
                            title='Clear all fields of the form'
                        >
                            <i className='bi bi-trash me-2'></i>
                            Clear
                        </Button>
                        <Button
                            variant='primary'
                            onClick={handleGenerate}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Spinner
                                        animation='border'
                                        size='sm'
                                        className='me-2'
                                    />
                                    Generation...
                                </>
                            ) : (
                                <>
                                    <i className='bi bi-qr-code me-2'></i>
                                    Generate
                                </>
                            )}
                        </Button>
                    </div>
                </Form>
            </Card>

            {error && (
                <Alert
                    variant='danger'
                    className='text-center'
                    dismissible
                    onClose={() => setError('')}
                >
                    <i className='bi bi-exclamation-triangle me-2'></i>
                    {error}
                </Alert>
            )}

            {generatedFiles.length > 0 && (
                <div className='mt-5'>
                    <div className='d-flex justify-content-between align-items-center mb-4'>
                        <h3 className='fw-bold mb-0'>Generation results</h3>
                        <span className='badge bg-primary'>
                            {generatedFiles.length} items
                        </span>
                    </div>
                    <div className='row row-cols-2 row-cols-md-3 row-cols-lg-4 g-4'>
                        {generatedFiles.map((file, index) => (
                            <div key={index} className='col'>
                                <div className='qr-preview-card'>
                                    <div className='qr-image-wrapper'>
                                        <img src={file.url} alt={file.name} />
                                    </div>
                                    <div className='qr-info'>
                                        <div className='qr-filename'>
                                            {file.name}
                                        </div>
                                    </div>
                                    <div className='custom-tooltip'>
                                        {file.info
                                            .split('\n')
                                            .map((line, i) => (
                                                <div key={i}>{line}</div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Container>
    );
}

export default App;
