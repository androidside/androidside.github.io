.. Python Flight Data Processing documentation master file, created by
   sphinx-quickstart on Tue Sep 12 12:57:03 2017.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Welcome
============
Welcome to Python Flight Data Processing's documentation! This project eases the process of plotting the flight data of BETTII. 

The three main classes that were created for this project are:

* :class:`~utils.field.Field`, describes a field
* :class:`~utils.dataset.DataSet`, implements the process of reading a list of fields from a folder or a list of folders
* :class:`~estimators.estimators.Estimator`, estimates the attitude using the sensors data and has methods to plot the results

Another common class is :class:`~utils.quat.Quat`, that provides easy  manipulation of quaternion objects. This project also relies heavily on the `matplotlib`_ for the plots and on the `pandas`_ modules, as it uses the :class:`pandas.DataFrame` data structure to store the time-series information. 

Contents
========

.. toctree::
   :maxdepth: 2
   
   tuto
   apidoc/modules

Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`

.. _pandas: https://pandas.pydata.org/pandas-docs/stable/
.. _matplotlib: https://matplotlib.org/index.html
.. _dataframe: https://pandas.pydata.org/pandas-docs/stable/dsintro.html#dataframe

